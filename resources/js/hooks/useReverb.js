import { useEffect, useRef, useCallback, useState } from 'react';
import { subscribeToChannel, unsubscribeFromChannel, initPusher, disconnectPusher } from '@/utils/reverb';

export function useReverbChannel(channelName, eventName, onEvent) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const pusher = initPusher();
    
    if (!pusher) {
      setError('WebSocket not initialized');
      return;
    }

    const channel = subscribeToChannel(channelName);
    
    if (!channel) {
      setError('Failed to subscribe to channel');
      return;
    }

    channel.bind(eventName, (data) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });

    channel.bind('pusher:subscription_succeeded', () => {
      setConnected(true);
      console.log(`[Reverb] Subscribed to ${channelName}`);
    });

    channel.bind('pusher:subscription_error', (err) => {
      setError(err);
      console.error(`[Reverb] Subscription error:`, err);
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        unsubscribeFromChannel(channelName);
      }
    };
  }, [channelName, eventName]);

  return { connected, error };
}

export function useKitchenOrders(onNewOrder, onStatusChange) {
  const [ wsConnected, setWsConnected ] = useState(false);
  const ordersRef = useRef([]);
  const callbackRef = useRef({ onNewOrder, onStatusChange });

  useEffect(() => {
    callbackRef.current = { onNewOrder, onStatusChange };
  }, [onNewOrder, onStatusChange]);

  useEffect(() => {
    const pusher = initPusher();
    
    if (!pusher) {
      console.warn('[Kitchen] WebSocket not available, using polling fallback');
      return;
    }

    const channel = subscribeToChannel('kitchen.orders');

    channel.bind('KitchenOrderCreated', (order) => {
      console.log('[Kitchen] New order received:', order.id);
      if (callbackRef.current.onNewOrder) {
        callbackRef.current.onNewOrder(order);
      }
    });

    channel.bind('KitchenOrderStatusChanged', (data) => {
      console.log('[Kitchen] Status changed:', data.id, data.status);
      if (callbackRef.current.onStatusChange) {
        callbackRef.current.onStatusChange(data);
      }
    });

    channel.bind('pusher:subscription_succeeded', () => {
      setWsConnected(true);
      console.log('[Kitchen] WebSocket connected');
    });

    setWsConnected(true);

    return () => {
      unsubscribeFromChannel('kitchen.orders');
    };
  }, []);

  return { wsConnected };
}

export function useRestoOrders(onNewOrder, onStatusChange) {
  const [ wsConnected, setWsConnected ] = useState(false);

  useEffect(() => {
    const pusher = initPusher();
    
    if (!pusher) {
      console.warn('[Resto] WebSocket not available, using polling fallback');
      return;
    }

    const channel = subscribeToChannel('resto.orders');

    channel.bind('RestoOrderCreated', (order) => {
      console.log('[Resto] New order received:', order.id);
      if (onNewOrder) {
        onNewOrder(order);
      }
    });

    channel.bind('RestoOrderStatusChanged', (data) => {
      console.log('[Resto] Status changed:', data.id, data.status);
      if (onStatusChange) {
        onStatusChange(data);
      }
    });

    channel.bind('pusher:subscription_succeeded', () => {
      setWsConnected(true);
      console.log('[Resto] WebSocket connected');
    });

    return () => {
      unsubscribeFromChannel('resto.orders');
    };
  }, [onNewOrder, onStatusChange]);

  return { wsConnected };
}

export default {
  useReverbChannel,
  useKitchenOrders,
  useRestoOrders,
};