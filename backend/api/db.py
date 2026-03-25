import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Admin client with bypass access (service role)
admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

def get_user_scoped_client(token: str) -> Client:
    """Returns a client scoped to the current user's JWT (enforces RLS)"""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY, {"global": {"headers": {"Authorization": f"Bearer {token}"}}})
