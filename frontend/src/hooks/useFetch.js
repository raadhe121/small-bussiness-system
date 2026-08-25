import { useEffect, useState } from "react";

/** Simple data-fetching hook: const {data, loading, error, refetch} = useFetch(fn, deps) */
export default function useFetch(fetchFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const execute = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchFn();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  };

  useEffect(() => {
    execute();
  }, deps);

  return { ...state, refetch: execute };
}
