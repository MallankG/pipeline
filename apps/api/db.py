import os
from dotenv import load_dotenv
from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_ANON_KEY:
    raise RuntimeError(
        "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY must be set"
    )

admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_user_scoped_client(jwt: str) -> Client:
    options = ClientOptions(headers={"Authorization": f"Bearer {jwt}"})
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options=options)
