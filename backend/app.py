"""StudyLink API entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import FRONTEND_ORIGINS
from backend.database import init_db
from backend.routers import auth, groups, profiles, students, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database schema on startup."""
    init_db()
    yield


app = FastAPI(title="StudyLink API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, users.router, profiles.router, students.router, groups.router):
    app.include_router(router)


@app.get("/")
def root():
    return {"message": "StudyLink API", "docs": "/docs"}
