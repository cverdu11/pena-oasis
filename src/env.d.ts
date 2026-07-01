declare const process: {
  env: {
    NODE_ENV?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };
};

declare module "*.png" {
  const source: string;
  export default source;
}
