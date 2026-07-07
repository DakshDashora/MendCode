from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from api.dbconfig import engine, Base
from api.routes.jobs import router as jobsrouter
from api.routes.auth import router as authrouter

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MendCode API",
    description="A modular API for automating code patches and validation using LangGraph",
    version="1.0.0"
)

# CORS Policies
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
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
