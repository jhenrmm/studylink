"""StudyLink API entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import init_db
from .routers import auth, profiles, students, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database schema on startup."""
    init_db()
    yield


app = FastAPI(title="StudyLink API", version="0.1.0", lifespan=lifespan)

for router in (auth.router, users.router, profiles.router, students.router):
    app.include_router(router)


@app.get("/")
def root():
    return {"message": "StudyLink API", "docs": "/docs"}
