from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas import AgentPlanIn, AgentPlanOut, ToolStep, AgentExecIn, AgentExecOut
from ..core.security import get_plan, Plan
from ..core.tiers import enforce_scrape, enforce_compare, enforce_forecast
from ..services.scraper import ensure_window_for_city
from ..services.forecast import forecast_city, forecast_cities
from ..services.llama_client import plan_with_llama
from ..utils.compare import compare_logic

router = APIRouter()

TOOLS = [
    {
        "name": "scrape_city",
        "description": "Fetch & cache hourly PM2.5/PM10 for a city over the last N days using Open-Meteo; upserts into MySQL.",
        "input_schema": {"type":"object","properties":{"city":{"type":"string"},"days":{"type":"integer","minimum":1,"maximum":90,"default":7}},"required":["city"]},
        "output_schema": {"type":"object"}
    },
    {
        "name": "compare_cities",
        "description": "Compute KPIs over the last N days per city (n_points, mean_pm25, min_pm25, max_pm25) and pick best/worst (lower is better).",
        "input_schema": {"type":"object","properties":{"cities":{"type":"array","items":{"type":"string"}},"days":{"type":"integer","minimum":1,"maximum":90,"default":7}},"required":["cities"]},
        "output_schema": {"type":"object"}
    },
    {
        "name": "forecast_city",
        "description": "Forecast next H days of PM2.5 for one city with SARIMAX; returns yhat + CI.",
        "input_schema": {"type":"object","properties":{"city":{"type":"string"},"horizonDays":{"type":"integer","minimum":1,"maximum":30,"default":7},"trainDays":{"type":"integer","minimum":7,"maximum":120,"default":30},"use_cache":{"type":"boolean","default":True}},"required":["city"]},
        "output_schema": {"type":"object"}
    },
    {
        "name": "forecast_multi",
        "description": "Forecast next H days for multiple cities and rank best/worst by mean predicted PM2.5.",
        "input_schema": {"type":"object","properties":{"cities":{"type":"array","items":{"type":"string"}},"horizonDays":{"type":"integer","minimum":1,"maximum":30,"default":7},"trainDays":{"type":"integer","minimum":7,"maximum":120,"default":30},"use_cache":{"type":"boolean","default":True}},"required":["cities"]},
        "output_schema": {"type":"object"}
    },
]

@router.get("/mcp/tools/list")
def mcp_list_tools():
    return {"tools": TOOLS}

@router.post("/mcp/tools/call")
def mcp_call_tool(call: dict, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    name = call.get("name")
    args = call.get("arguments", {})

    if name == "scrape_city":
        enforce_scrape(plan, args.get("days", 7))
        inserted, (lat, lon) = ensure_window_for_city(db, args["city"], args.get("days", 7))
        return {"ok": True, "result": {"city": args["city"], "days": args.get("days", 7), "inserted": inserted, "lat": lat, "lon": lon}}

    if name == "compare_cities":
        cities = args["cities"]; days = args.get("days", 7)
        enforce_compare(plan, cities, days)
        for c in cities: ensure_window_for_city(db, c, days)
        return {"ok": True, "result": compare_logic(db, cities, days)}

    if name == "forecast_city":
        enforce_forecast(plan, args.get("horizonDays", 7), 1)
        out = forecast_city(db, args["city"], args.get("horizonDays", 7), args.get("trainDays", 30), args.get("use_cache", True))
        return {"ok": True, "result": out}

    if name == "forecast_multi":
        cities = args["cities"]
        enforce_forecast(plan, args.get("horizonDays", 7), len(cities))
        out = forecast_cities(db, cities, args.get("horizonDays", 7), args.get("trainDays", 30), args.get("use_cache", True))
        return {"ok": True, "result": out}

    raise HTTPException(404, f"Unknown tool: {name}")

@router.post("/plan", response_model=AgentPlanOut)
def agent_plan(payload: AgentPlanIn):
    plan_obj = plan_with_llama(payload.prompt, TOOLS, temperature=0.2)
    steps = [ToolStep(**step) for step in plan_obj.get("plan", [])]
    return {
        "plan": steps, 
        "notes": plan_obj.get("notes"),
        "irrelevant": plan_obj.get("irrelevant", False)
    }

def _execute_step(db: Session, plan: Plan, step: ToolStep):
    name, args = step.name, (step.arguments or {})

    if name == "scrape_city":
        enforce_scrape(plan, args.get("days", 7))
        inserted, (lat, lon) = ensure_window_for_city(db, args["city"], args.get("days", 7))
        return {"tool": name, "ok": True, "args": args, "result": {"city": args["city"], "days": args.get("days", 7), "inserted": inserted, "lat": lat, "lon": lon}}

    if name == "compare_cities":
        cities = args["cities"]; days = args.get("days", 7)
        enforce_compare(plan, cities, days)
        for c in cities: ensure_window_for_city(db, c, days)
        res = compare_logic(db, cities, days)
        return {"tool": name, "ok": True, "args": args, "result": res}

    if name == "forecast_city":
        enforce_forecast(plan, args.get("horizonDays", 7), 1)
        res = forecast_city(db, args["city"], args.get("horizonDays", 7), args.get("trainDays", 30), args.get("use_cache", True))
        return {"tool": name, "ok": True, "args": args, "result": res}

    if name == "forecast_multi":
        cities = args["cities"]
        enforce_forecast(plan, args.get("horizonDays", 7), len(cities))
        res = forecast_cities(db, cities, args.get("horizonDays", 7), args.get("trainDays", 30), args.get("use_cache", True))
        return {"tool": name, "ok": True, "args": args, "result": res}

    return {"tool": name, "ok": False, "args": args, "error": "Unknown tool"}

@router.post("/execute", response_model=AgentExecOut)
def agent_execute(payload: AgentExecIn, request: Request, plan: Plan = Depends(get_plan), db: Session = Depends(get_db)):
    trace = []
    steps: list[ToolStep] = []
    last_ok = None

    if payload.plan:
        steps = [ToolStep(**s) if not isinstance(s, ToolStep) else s for s in payload.plan]
    elif payload.prompt:
        plan_obj = plan_with_llama(payload.prompt, TOOLS, temperature=0.2)
        steps = [ToolStep(**step) for step in plan_obj.get("plan", [])]
        trace.append({"planner": {"notes": plan_obj.get("notes"), "steps": [s.dict() for s in steps]}})
    else:
        raise HTTPException(400, "Provide either prompt or plan")

    for step in steps:
        try:
            result = _execute_step(db, plan, step)
        except Exception as e:
            result = {"tool": step.name, "ok": False, "args": step.arguments, "error": str(e)}
        trace.append(result)
        if result.get("ok"):
            last_ok = result
        else:
            break

    successes = [t for t in trace if t.get("ok")]
    answer = f"Executed {len(successes)} step(s)."
    return {"answer": answer, "trace": trace, "final": (last_ok.get("result") if last_ok else None)}
