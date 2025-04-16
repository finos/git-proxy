export const toClass = function (obj: any, proto: any) {
  obj = JSON.parse(JSON.stringify(obj));
  obj.__proto__ = proto;
  return obj;
};
