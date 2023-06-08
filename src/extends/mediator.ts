/*
 * @Descripttion: 
 * @version: 
 * @Author: houqiangxie
 * @Date: 2023-06-02 14:44:36
 * @LastEditors: houqiangxie
 * @LastEditTime: 2023-06-08 11:37:02
 */
// mediator.ts
export interface MediatorProps {
  uuid?: number;
  publish?: (topic: string, ...args: unknown[]) => void;
  subscribe?: (topic: string, callback: (...args: unknown[]) => void) => void;
}

const mediator = (function () {
  let topics:any = [],
    uuid = 0;

  function subscribe(topic: string, callback: (...args: unknown[]) => void) {
    uuid++;
    topics[topic] = topics[topic]
      ? [...topics[topic], { callback, uuid }]
      : [{ callback, uuid }];
  }

  function publish(topic: string, ...args: unknown[]) {
    if (topics[topic]) {
      topics[topic].map((item) => item.callback(...args));
    }
  }
  return {
    install: function (obj: MediatorProps) {
      obj.uuid = uuid;
      obj.publish = publish;
      obj.subscribe = subscribe;
      return obj;
    },
  };
})();

export default mediator;
