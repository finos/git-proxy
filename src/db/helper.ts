export const toClass = function (obj: any, proto: any) {
  obj = JSON.parse(JSON.stringify(obj));
  obj.__proto__ = proto;
  return obj;
};

export const trimTrailingDotGit = (str: string): string => {
  const target = '.git';
  if (str.endsWith(target)) {
    // extract string from 0 to the end minus the length of target
    return str.slice(0, -target.length);
  }
  return str;
};

