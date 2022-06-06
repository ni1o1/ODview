import PubSub from 'pubsub-js';

export function useSubscribe (msg, callback) {
    return PubSub.subscribe(msg, callback);
}
export function usePublish () {
    return PubSub.publish;
}
export function useUnsubscribe () {
    return PubSub.unsubscribe;
}