import { useEffect } from "react";
import { supabase } from "@/services/supabaseClient";

const TestSupabase = () => {
  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase.auth.getUser();
      console.log("Supabase connection test:", { data, error });
    };

    testConnection();
  }, []);

  return <div>Supabase Test Component Loaded</div>;
};

export default TestSupabase;
