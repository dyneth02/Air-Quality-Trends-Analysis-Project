import os, json, requests

OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")

CRITIC_PROMPT = """You are a strict capability critic for an MCP agent.
The agent ONLY has these tools: scrape_city, compare_cities, forecast_city, forecast_multi.
They work ONLY on air-quality data (PM2.5/PM10) over cities and time ranges.

Your job:
1) Decide if the user's request is fully supported by these tools.
2) If the request is MIXED (supported + unsupported actions like writing blogs, emailing, designing, exporting docs), split it:
   - Extract the supported subtask (rewrite it cleanly).
   - List the unsupported parts with reasons.
3) If the request is gibberish or entirely unrelated (e.g., cooking, poems, finance), mark as IRRELEVANT.

Return STRICT JSON:
{
  "category": "supported" | "mixed" | "irrelevant",
  "unsupported_reasons": [ "<why each part is not possible with the tools>" ],
  "supported_rewrite": "if category is mixed, rewrite only the supported part; else empty string",
  "examples": [
    "Compare Colombo and Kandy last 7 days",
    "Forecast Panadura next 3 days (train 7 days)"
  ]
}
Only JSON. No extra text.
"""

SYSTEM_PROMPT = """You are a planning agent. Turn the user's request into a JSON plan of tool calls.
Only use these tools and their JSON schemas. Return STRICT JSON with this shape:

{
  "plan": [
    {"name": "<tool_name>", "arguments": { ... }},
    ...
  ],
  "notes": "very brief explanation",
  "irrelevant": false
}

Strictly follow these Rules:
- Use only the listed tools; arguments must match the schemas.
- If the user asks to compare, use compare_cities with at least 2 cities.
- If forecasting multiple cities, use forecast_multi.
- If data may be stale, insert a scrape_city step BEFORE compare/forecast.
- REJECT requests like "Generate me an image comparing Colombo and Kandy for past 7 days", "Generate me an blogpost article comparing Colombo and Kandy for past 7 days", "Generate me an newspaper article forcasting Colombo and Kandy 7 days ahead"
- REJECT asks requiring non-available abilities (blog writing, emails, PDFs, images, SQL DDL, etc.).
- If the user's request is completely unrelated to air quality analysis (e.g., asking about weather, cooking, random topics), set "irrelevant": true and "plan": [].
- For mixed requests: plan only the tool-capable part, set irrelevant=false, and include notes with unsupported_reasons.
- Keep notes short. Do not include any text outside of the JSON object.
"""

def build_tool_catalog(tools: list[dict]) -> str:
    return json.dumps(tools, indent=2, ensure_ascii=False)

def critique_prompt(prompt: str, tools: list[dict], temperature: float = 0.0, timeout: int = 45) -> dict:
    """Critique a prompt to determine if it's supported, mixed, or irrelevant."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": CRITIC_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": temperature}
    }
    r = requests.post(f"{OLLAMA_BASE}/api/chat", json=payload, timeout=timeout)
    r.raise_for_status()
    raw = r.json()["message"]["content"]
    try:
        return json.loads(raw)
    except Exception:
        import re
        m = re.search(r"\{.*\}", raw, re.S)
        return json.loads(m.group(0)) if m else {"category":"irrelevant","unsupported_reasons":["Non-JSON critic output"],"supported_rewrite":""}

def plan_with_llama(prompt: str, tools: list[dict], temperature: float = 0.2, timeout: int = 60) -> dict:
    """Ask Ollama (local) to produce a JSON plan."""
    sys = SYSTEM_PROMPT + "\n\nTOOLS (JSON Schemas):\n" + build_tool_catalog(tools)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": sys},
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": temperature}
    }
    r = requests.post(f"{OLLAMA_BASE}/api/chat", json=payload, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    content = data["message"]["content"]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{.*\}", content, re.S)
        if not m:
            raise RuntimeError("LLM did not return JSON plan")
        return json.loads(m.group(0))

def plan_with_critic(prompt: str, tools: list[dict], temperature: float = 0.2, timeout: int = 60) -> dict:
    """Two-stage planner: critique first, then plan if supported."""
    critic = critique_prompt(prompt, tools)
    cat = critic.get("category","irrelevant")
    
    if cat == "irrelevant":
        return {
            "plan": [], 
            "notes": None, 
            "irrelevant": True,
            "reason": "Your request cannot be done with the available tools.",
            "unsupported_reasons": critic.get("unsupported_reasons",[]),
            "critic": critic
        }
    
    # Use original prompt if supported, or rewritten prompt if mixed
    use_prompt = prompt if cat == "supported" else critic.get("supported_rewrite") or prompt
    
    # Fall back to existing LLM planner
    base = plan_with_llama(use_prompt, tools, temperature=temperature, timeout=timeout)
    
    # If mixed, carry reasons forward
    if cat == "mixed":
        base["unsupported_reasons"] = critic.get("unsupported_reasons",[])
        note = base.get("notes") or ""
        if base["unsupported_reasons"]:
            base["notes"] = (note + (" | " if note else "") +
                             "Unsupported: " + "; ".join(base["unsupported_reasons"]))
    
    base["critic"] = critic
    return base

def generate_llm_report(comparison_data, chart_data, cities, period_days, show_combined):
    """
    Generate LLM-powered comparison report using Gemma3:4b
    """
    
    SYSTEM_PROMPT = """You are an environmental health expert AI that generates structured air quality comparison reports. Your task is to analyze air quality data and return a comprehensive JSON report in the exact structure provided.

CRITICAL REQUIREMENTS:
1. You MUST return ONLY valid JSON - no additional text, explanations, or markdown
2. You MUST use the exact JSON structure provided below
3. You MUST fill in all placeholders with actual data from the analysis
4. You MUST use scientific, factual language while maintaining accessibility
5. You MUST base all conclusions on the provided PM2.5 data and established health guidelines

JSON STRUCTURE TO FOLLOW:
{
  "report": {
    "title": "Air Quality Comparative Analysis & Health Impact Assessment",
    "executiveOverview": {
      "summary": "The analysis reveals significant disparities in air quality across the monitored cities. [City with best performance] demonstrates the most favorable conditions with an average PM2.5 of [X] µg/m³, while [City with worst performance] requires immediate attention with levels reaching [Y] µg/m³."
    },
    "cityPerformanceBreakdown": {
      "topPerformer": {
        "city": "[Best City]",
        "averagePM25": "[Value] µg/m³",
        "healthImplications": "Air quality generally falls within acceptable limits, posing minimal health risks to the general population. Sensitive groups may still experience mild symptoms during peak periods.",
        "icon": "🏆"
      },
      "areasNeedingImprovement": {
        "city": "[Worst City]",
        "averagePM25": "[Value] µg/m³",
        "healthRisks": "Prolonged exposure at these levels increases risks of respiratory and cardiovascular diseases. Immediate protective measures recommended.",
        "icon": "⚠️"
      }
    },
    "healthAwarenessInsights": {
      "shortTermExposureEffects": {
        "healthyAdults": "Minor irritation, temporary breathing discomfort",
        "sensitiveGroups": "Aggravated asthma, increased respiratory symptoms",
        "elderlyAndChildren": "Higher susceptibility to respiratory infections"
      },
      "longTermHealthImplications": {
        "risks": [
          "Chronic respiratory diseases",
          "Cardiovascular complications",
          "Reduced lung function development in children",
          "Increased cancer risk with prolonged exposure"
        ]
      }
    },
    "regionalPatternsAndTrends": {
      "description": "The data reveals [describe any patterns - seasonal variations, consistent poor performers, improving/declining trends]"
    },
    "protectiveRecommendations": {
      "immediateActions": {
        "highPM25Areas": "Limit outdoor activities, use N95 masks",
        "indoorAirQuality": "Employ HEPA filters, maintain proper ventilation",
        "vulnerableGroups": "Regular health monitoring, avoid peak pollution hours"
      },
      "longTermCommunityMeasures": [
        "Enhanced public transportation systems",
        "Green space development",
        "Industrial emission controls",
        "Public health awareness campaigns"
      ]
    },
    "comparativeRiskAssessment": {
      "description": "The analysis indicates that residents in [worst city] face approximately [X]% higher health risks compared to those in [best city], emphasizing the need for targeted interventions."
    }
  }
}

DATA INTERPRETATION GUIDELINES:
- PM2.5 levels below 12 µg/m³: Good air quality
- PM2.5 levels 12-35 µg/m³: Moderate air quality  
- PM2.5 levels 35-55 µg/m³: Unhealthy for sensitive groups
- PM2.5 levels above 55 µg/m³: Unhealthy for all populations
- Calculate risk percentage: ((worst_city_pm25 - best_city_pm25) / best_city_pm25 * 100)

Remember: Return ONLY the JSON object, no other text."""

    # Prepare the data for the LLM
    data_context = {
        "comparison_data": comparison_data,
        "chart_data": chart_data,
        "cities": cities,
        "period_days": period_days,
        "show_combined": show_combined
    }
    
    # Create the user prompt with the data
    user_prompt = f"""Please analyze the following air quality comparison data and generate a comprehensive report:

Cities analyzed: {', '.join(cities) if cities else 'N/A'}
Analysis period: {period_days} days
Best performing city: {comparison_data.get('best', 'N/A')}
Worst performing city: {comparison_data.get('worst', 'N/A')}

City statistics:
{json.dumps(comparison_data.get('byCity', {}), indent=2)}

Please generate the structured report following the exact JSON format provided in the system prompt."""

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3}
    }
    
    try:
        r = requests.post(f"{OLLAMA_BASE}/api/chat", json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        content = data["message"]["content"]
        
        # Parse the JSON response
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            import re
            m = re.search(r"\{.*\}", content, re.S)
            if m:
                return json.loads(m.group(0))
            else:
                raise RuntimeError("LLM did not return valid JSON")
                
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to communicate with LLM: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Failed to generate LLM report: {str(e)}")

def generate_llm_forecast_report(forecast_data, chart_data, cities, horizon_days, train_days, show_ci, show_combined, selected_model):
    """
    Generate LLM-powered forecast report using Gemma3:4b
    """
    
    SYSTEM_PROMPT = """You are an environmental health expert AI that generates structured air quality forecast reports. Your task is to analyze forecast data and return a comprehensive JSON report in the exact structure provided.

CRITICAL REQUIREMENTS:
1. You MUST return ONLY valid JSON - no additional text, explanations, or markdown
2. You MUST use the exact JSON structure provided below
3. You MUST fill in all placeholders with actual data from the analysis
4. You MUST use scientific, factual language while maintaining accessibility
5. You MUST base all conclusions on the provided forecast data and established health guidelines

JSON STRUCTURE TO FOLLOW:
{
  "report": {
    "title": "AI-Powered Air Quality Forecast Analysis & Health Impact Assessment",
    "executiveOverview": {
      "summary": "The forecast analysis reveals significant variations in predicted air quality across the monitored cities. [City with best forecast] demonstrates the most favorable predicted conditions with an average forecast of [X] µg/m³, while [City with challenging forecast] requires attention with predicted levels reaching [Y] µg/m³."
    },
    "forecastPerformance": {
      "bestForecast": {
        "city": "[Best City]",
        "averageForecast": "[Value] µg/m³",
        "forecastImplications": "Predicted air quality generally falls within acceptable limits, posing minimal health risks to the general population. Sensitive groups may still experience mild symptoms during peak periods.",
        "icon": "📈"
      },
      "challengingForecast": {
        "city": "[Challenging City]",
        "averageForecast": "[Value] µg/m³",
        "forecastRisks": "Predicted exposure at these levels increases risks of respiratory and cardiovascular diseases. Immediate protective measures recommended.",
        "icon": "⚠️"
      }
    },
    "modelPerformance": {
      "confidenceLevel": "High confidence in forecast accuracy based on historical data patterns",
      "predictionReliability": "Model shows strong predictive capability with [X]% accuracy on validation data",
      "modelType": "[SARIMAX/Prophet] - Optimized for time series forecasting with seasonal patterns"
    },
    "forecastTrends": {
      "patterns": [
        "Seasonal variation patterns detected",
        "Weekend vs weekday differences observed",
        "Peak pollution hours identified",
        "Long-term trend analysis completed"
      ]
    },
    "healthImpact": {
      "shortTermRisks": {
        "highRiskAreas": "Areas with predicted PM2.5 levels above 35 µg/m³",
        "vulnerableGroups": "Children, elderly, and those with respiratory conditions at higher risk"
      },
      "longTermImplications": [
        "Chronic respiratory disease development risk",
        "Cardiovascular health impact assessment",
        "Reduced lung function in children",
        "Increased cancer risk with prolonged exposure"
      ]
    },
    "recommendations": {
      "immediateActions": [
        "Monitor air quality alerts in high-risk areas",
        "Use N95 masks during predicted high pollution periods",
        "Limit outdoor activities during peak forecast hours",
        "Ensure proper indoor air filtration systems"
      ],
      "longTermPlanning": [
        "Develop air quality monitoring infrastructure",
        "Implement green space development plans",
        "Enhance public transportation systems",
        "Create public health awareness campaigns"
      ]
    },
    "uncertaintyAssessment": {
      "description": "The forecast model demonstrates [X]% confidence in predictions, with uncertainty increasing over longer time horizons. Weather patterns and seasonal variations may impact forecast accuracy."
    }
  }
}

DATA INTERPRETATION GUIDELINES:
- PM2.5 levels below 12 µg/m³: Good air quality forecast
- PM2.5 levels 12-35 µg/m³: Moderate air quality forecast  
- PM2.5 levels 35-55 µg/m³: Unhealthy for sensitive groups forecast
- PM2.5 levels above 55 µg/m³: Unhealthy for all populations forecast
- Confidence intervals indicate prediction uncertainty
- Model type affects forecast reliability and accuracy

Remember: Return ONLY the JSON object, no other text."""

    # Prepare the data for the LLM
    data_context = {
        "forecast_data": forecast_data,
        "chart_data": chart_data,
        "cities": cities,
        "horizon_days": horizon_days,
        "train_days": train_days,
        "show_ci": show_ci,
        "show_combined": show_combined,
        "selected_model": selected_model
    }
    
    # Create the user prompt with the data
    user_prompt = f"""Please analyze the following air quality forecast data and generate a comprehensive report:

Cities forecasted: {', '.join(cities) if cities else 'N/A'}
Forecast horizon: {horizon_days} days
Training period: {train_days} days
Model used: {selected_model}
Best forecasted city: {forecast_data.get('best', 'N/A')}
Challenging forecasted city: {forecast_data.get('worst', 'N/A')}

Forecast statistics:
{json.dumps(forecast_data.get('summary', {}), indent=2)}

Please generate the structured report following the exact JSON format provided in the system prompt."""

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3}
    }
    
    try:
        r = requests.post(f"{OLLAMA_BASE}/api/chat", json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        content = data["message"]["content"]
        
        # Parse the JSON response
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            import re
            m = re.search(r"\{.*\}", content, re.S)
            if m:
                return json.loads(m.group(0))
            else:
                raise RuntimeError("LLM did not return valid JSON")
                
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to communicate with LLM: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Failed to generate LLM forecast report: {str(e)}")
