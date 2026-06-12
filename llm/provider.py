import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def get_llm(provider: str = "gemini"):
    """
    Returns an LLM instance based on the provider name.
    """
    if provider.lower() == "groq":
        return ChatGroq(
            # model = "meta-llama/llama-4-scout-17b-16e-instruct",
            # model = "llama-3.3-70b-versatile",
            model="openai/gpt-oss-120b",
            temperature=0,
        )
    elif provider.lower() == "gemini":
        return ChatGoogleGenerativeAI(
            model="models/gemini-2.0-flash",
            temperature=0,
        )
    else:
        raise ValueError(f"Unsupported provider: {provider}. Choose 'gemini' or 'groq'.")

# Default instance for nodes that don't pass provider explicitly yet
# We will refactor nodes to use get_llm or pass the model in the state
llm = get_llm(os.getenv("DEFAULT_LLM_PROVIDER", "gemini"))
