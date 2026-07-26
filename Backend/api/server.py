from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from api.dbconfig import engine, Base
from api.routes.jobs import router as jobsrouter
from api.routes.auth import router as authrouter

# Initialize Database
Base.metadata.create_all(bind=engine)

# Self-healing schema migrations for warning columns
from sqlalchemy import text
with engine.connect() as conn:
    try:
        db_url = engine.url.drivername
        if "postgresql" in db_url:
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delete_warning_sent BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP;"))
        else:
            # SQLite alter (try-except protects already exists errors)
            conn.execute(text("ALTER TABLE jobs ADD COLUMN delete_warning_sent BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE jobs ADD COLUMN warning_sent_at TIMESTAMP;"))
        conn.commit()
    except Exception as e:
        # Ignore already exists errors
        pass

app = FastAPI(
    title="MendCode API",
    description="A modular API for automating code patches and validation using LangGraph",
    version="1.0.0"
)

# Start background cleanup scheduler thread on startup
from api.utils.cleanup import start_cleanup_scheduler

@app.on_event("startup")
def on_startup():
    # Poll cleanup changes every 1 hour
    start_cleanup_scheduler(interval_seconds=3600)

# CORS Policies
import os
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Support local dev variations
origins = [FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom OpenAPI Schema for Swagger Auth
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="MendCode API",
        version="1.0.0",
        description="A modular API for automating code patches and validation using LangGraph",
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }

    for path in openapi_schema["paths"].values():
        for operation in path.values():
            operation["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Include Routers
app.include_router(authrouter, prefix="/api/v1")
app.include_router(jobsrouter, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)
