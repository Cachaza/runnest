import { useState } from 'react';

export function usePullToRefresh(refreshAction: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await refreshAction();
    } finally {
      setRefreshing(false);
    }
  }

  return {
    onRefresh,
    refreshing,
  };
}
