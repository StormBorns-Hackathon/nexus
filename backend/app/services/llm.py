from openai import AsyncOpenAI
import os

client = AsyncOpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)
MODEL_NAME = "openai/gpt-oss-120b:free"
