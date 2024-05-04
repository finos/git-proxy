const express = require('express');
const proxy = require('express-http-proxy');
const router = new express.Router();
const chain = require('../chain');
const config = require('../../config');

/**
 * Get git path from URL path.
 * @param {string} urlPath URL path in GitLab or GitHub format.
 * @return {string} The git path or undefined if given url path is invalid.
 */
const getGitPathFromUrlPath = (urlPath) => {
  // urlPath = '/{namespace}/{repo}.git/{git-path}' 
  // where {namespace} can be a path structure with multiple path segments
  // GitLab -> https://docs.gitlab.com/ee/user/namespace/index.html
  // GitHub -> https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories  
  const gitPathSegments = [''];
  let repoSegmentFound = false;
  for (const urlPathSegment of urlPath.split('/')) {
    if (repoSegmentFound) {
      gitPathSegments.push(urlPathSegment);
    }
    // eslint-disable-next-line no-useless-escape
    if (urlPathSegment.match(/[a-zA-Z0-9\-]+\.git/)) {
      repoSegmentFound = true;
    }
  }
  return repoSegmentFound ? gitPathSegments.join('/') : undefined;
}

/**
 * Check whether an HTTP request has the expected properties of a
 * Git HTTP request. The URL is expected to be "sanitized", stripped of
 * specific paths such as the GitHub {owner}/{repo}.git parts.
 * @param {string} url Sanitized URL which only includes the path specific to git
 * @param {*} headers Request headers (TODO: Fix JSDoc linting and refer to node:http.IncomingHttpHeaders)
 * @return {boolean} If true, this is a valid and expected git request. Otherwise, false.
 */
const validGitRequest = (url, headers) => {
  const { 'user-agent': agent, accept } = headers;
  if (['/info/refs?service=git-upload-pack', '/info/refs?service=git-receive-pack'].includes(url)) {
    // https://www.git-scm.com/docs/http-protocol#_discovering_references
    // We can only filter based on User-Agent since the Accept header is not
    // sent in this request
    return agent.startsWith('git/');
  }
  if (['/git-upload-pack', '/git-receive-pack'].includes(url)) {
    // https://www.git-scm.com/docs/http-protocol#_uploading_data
    return agent.startsWith('git/') && accept.startsWith('application/x-git-');
  }
  return false;
};

const proxyFilter = async function (req, res) {
  try {
    console.log('request url: ', req.url);
    console.log('host: ', req.headers.host);
    console.log('user-agent: ', req.headers['user-agent']);
    const gitPath = getGitPathFromUrlPath(req.url);
    if (gitPath === undefined || !validGitRequest(gitPath, req.headers)) {
      res.status(400).send('Invalid request received');
      return false;
    }
    if (req.body && req.body.length) {
      req.rawBody = req.body.toString('utf8');
    }

    const action = await chain.exec(req, res);
    console.log('action processed');

    if (action.error || action.blocked) {
      res.set('content-type', 'application/x-git-receive-pack-result');
      res.set('transfer-encoding', 'chunked');
      res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
      res.set('pragma', 'no-cache');
      res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
      res.set('vary', 'Accept-Encoding');
      res.set('x-frame-options', 'DENY');
      res.set('connection', 'close');

      let message;

      if (action.error) {
        message = action.errorMessage;
        console.error(message);
      }
      if (action.blocked) {
        message = action.blockedMessage;
      }

      const packetMessage = handleMessage(message);

      console.log(req.headers);

      res.status(200).send(packetMessage);

      return false;
    }

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

const proxyReqOptDecorator = function (proxyReqOpts, srcReq) {
    return proxyReqOpts;
};

const proxyReqBodyDecorator = function (bodyContent, srcReq) {
  if (srcReq.method === 'GET') {
    return '';
  }
  return bodyContent;
};

const proxyErrorHandler = function (err, res, next) {
  console.log(`ERROR=${err}`);
  next(err);
};

for (const proxyConfig of config.getProxyConfigList()) {
  if (proxyConfig.enabled) {
    const proxyReqPathResolver = (req) => {
      const url = req.originalUrl.replace(proxyConfig.path, proxyConfig.url);
      console.log('Sending request to ' + url);
      return url;
    };
    const proxyOptions = {
      preserveHostHdr: false,
      filter: proxyFilter,
      proxyReqPathResolver: proxyReqPathResolver,
      proxyReqOptDecorator: proxyReqOptDecorator,        
      proxyReqBodyDecorator: proxyReqBodyDecorator,
      proxyErrorHandler: proxyErrorHandler,
    };
    router.use(
      proxyConfig.path,
      proxy(proxyConfig.url, proxyOptions)
    );
    console.log(`Proxy route: ${proxyConfig.path} -> ${proxyConfig.url}`);
  } 
}

const handleMessage = (message) => {
  const errorMessage = `\t${message}`;
  const len = 6 + new TextEncoder().encode(errorMessage).length;

  const prefix = len.toString(16);
  const packetMessage = `${prefix.padStart(4, '0')}\x02${errorMessage}\n0000`;
  return packetMessage;
};

module.exports = {
  router,
  handleMessage,
  validGitRequest,
  getGitPathFromUrlPath,
};
