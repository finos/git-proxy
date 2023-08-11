const toClass = function (obj, proto) {
  obj = JSON.parse(JSON.stringify(obj));
  obj.__proto__ = proto;
  return obj;
};

module.exports.toClass = toClass;
