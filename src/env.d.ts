declare const process: {
  env: {
    NODE_ENV?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_DATA_AGREEMENT_FUNCTION_NAME?: string;
  };
};

declare module "*.png" {
  const source: string;
  export default source;
}

declare module "*.pdf" {
  const source: string;
  export default source;
}
