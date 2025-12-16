# 🌍 AirSense – Multi-Agentic Air Quality Trends Analysis System

AirSense is a **full-stack air quality monitoring and analytics platform** designed to transform fragmented environmental data into actionable insights.  
The system aggregates multi-source PM2.5 and PM10 data, performs comparative analytics, delivers AI-powered forecasts, and enables natural-language analytics through an LLM-based planning agent.

This project was developed as a **group project at SLIIT** for the *Information Retrieval and Web Analytics (IT3041)* module.

---

## 🚀 Key Features

### 🌐 Multi-Source Data Aggregation
- Scrapes hourly air quality data from **Open-Meteo, OpenAQ, IQAir, and WAQI**
- Applies **weighted aggregation with outlier trimming** to ensure reliable data
- Persists clean, aggregated time-series data in MySQL

### 📊 Advanced Analytics
- Multi-city comparison with KPIs (mean, min, max PM levels)
- Best vs worst city ranking
- Part-to-whole and trend-based analysis

### 📈 AI-Powered Forecasting
- Time-series forecasting using **SARIMAX**
- Confidence intervals and backtesting (MAE, RMSE)
- Single-city and multi-city prediction support

### 🤖 LLM-Based Planning Agent (Enterprise Tier)
- Natural-language queries converted into executable analysis plans
- Uses a **critic-based reflection pattern** to ensure security and capability limits
- Transparent execution traces for explainability

### 🔐 Security & Tiered Access
- JWT-based authentication with bcrypt password hashing
- Subscription tiers: **Free, Pro, Enterprise**
- Plan-based enforcement of data windows, city limits, and forecast horizons

### 🧾 Professional Reporting
- Auto-generated **PDF reports** with charts and KPI tables
- Server-side rendering using ReportLab

---

## 🧱 System Architecture

AirSense follows a **four-layer architecture**:

1. **Presentation Layer** – React SPA with interactive charts  
2. **Application Layer** – FastAPI backend with modular routers  
3. **Data Layer** – MySQL + SQLAlchemy ORM  
4. **Intelligent Agent Layer** – LLM planner with MCP-style tool orchestration  

This architecture enables scalability, security, and clear separation of concerns :contentReference[oaicite:1]{index=1}.

---

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS, Recharts  
- **Backend:** FastAPI (Python), Uvicorn  
- **Database:** MySQL, SQLAlchemy  
- **AI / Analytics:** SARIMAX, LLM (Ollama / Gemma), Agent Planning  
- **Security:** JWT, bcrypt  
- **Reporting:** ReportLab (PDF generation)

---

## 🧠 Responsible AI Practices

- **Fairness:** Multi-source aggregation to reduce sensor bias  
- **Explainability:** Interpretable SARIMAX models + execution traces  
- **Transparency:** Visible data sources, KPIs, and agent steps  
- **Privacy:** No personal location tracking; secure credential handling  

---

## 👥 Team & Leadership

**Team Leader & Full-Stack Integration Architect:**  
Hirusha D G A D (IT23183018)

Key contributions include:
- AI forecasting engine & backtesting
- LLM agent design and orchestration
- Authentication & tier enforcement
- System-wide integration and documentation leadership

(Full contribution breakdown available in the final report) :contentReference[oaicite:2]{index=2}.

---

## 🎯 Academic Context

- **Institution:** Sri Lanka Institute of Information Technology (SLIIT)  
- **Module:** IT3041 – Information Retrieval and Web Analytics  
- **Year:** 2025  
- **Project Type:** Group Project (Industry-oriented system)

---

## 📌 Future Enhancements

- Real-time alerts for pollution thresholds
- Additional data sources & ML models
- Extended agent reasoning capabilities
- Cloud deployment and CI/CD pipelines

---

## 📜 License

This project is released for **academic and learning purposes**.
