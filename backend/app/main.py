from fastapi import FastAPI
from .models.database import Base, engine
from app.api import webhooks, workflows, websocket 

app = FastAPI()

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

@app.get("/")
async def root():
    return {"message": "hello"}