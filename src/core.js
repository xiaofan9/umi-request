import Onion from './onion/onion';
import { MapCache } from './utils';
import addfixInterceptor from './interceptor/addfix';
import fetchMiddleware from './middleware/fetch';
import parseResponseMiddleware from './middleware/parseResponse';
import simplePost from './middleware/simplePost';
import simpleGet from './middleware/simpleGet';

// 旧版拦截器为共享
const requestInterceptors = [addfixInterceptor];
const responseInterceptors = [];
const defaultMiddlewares = [simplePost, simpleGet, fetchMiddleware, parseResponseMiddleware];

class Core {
  constructor(initOptions) {
    this.onion = new Onion(defaultMiddlewares);
    this.fetchIndex = 2; // 请求中间件位置
    this.mapCache = new MapCache(initOptions);
  }

  use(newMiddleware, index = 0) {
    this.onion.use(newMiddleware, index);
    return this;
  }

  static requestUse(handler) {
    if (typeof handler !== 'function') throw new TypeError('Interceptor must be function!');
    requestInterceptors.push(handler);
  }

  static responseUse(handler) {
    if (typeof handler !== 'function') throw new TypeError('Interceptor must be function!');
    responseInterceptors.push(handler);
  }

  // 执行请求前拦截器
  static dealRequestInterceptors(ctx) {
    const reducer = (p1, p2) =>
      p1.then((ret = {}) => {
        ctx.req.url = ret.url || ctx.req.url;
        ctx.req.options = ret.options || ctx.req.options;
        return p2(ctx.req.url, ctx.req.options);
      });
    return requestInterceptors.reduce(reducer, Promise.resolve()).then((ret = {}) => {
      ctx.req.url = ret.url || ctx.req.url;
      ctx.req.options = ret.options || ctx.req.options;
      return Promise.resolve();
    });
  }

  request(url, options) {
    const { onion } = this;
    const obj = {
      req: { url, options },
      res: null,
      cache: this.mapCache,
      responseInterceptors,
    };
    if (typeof url !== 'string') {
      throw new Error('url MUST be a string');
    }

    return new Promise((resolve, reject) => {
      Core.dealRequestInterceptors(obj)
        .then(() => onion.execute(obj))
        .then(() => {
          resolve(obj.res);
        })
        .catch(error => {
          const { errorHandler } = obj.req.options;
          if (errorHandler) {
            try {
              const data = errorHandler(error);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(error);
          }
        });
    });
  }
}

export default Core;
