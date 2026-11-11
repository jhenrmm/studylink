"""StudyLink API entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from database import init_db
from routers import auth, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database schema on startup."""
    init_db()
    yield


app = FastAPI(title="StudyLink API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"message": "StudyLink API", "docs": "/docs"}
