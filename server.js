const express = require("express");
const {
  createProxyMiddleware,
  responseInterceptor
} = require("http-proxy-middleware");

const app = express();

app.set("trust proxy", true);

const TARGET = "https://www.usdt.love";
const TARGET_HOST = "www.usdt.love";

function getPublicProtocol(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim();
  }
  return req.protocol || "https";
}

function getPublicHost(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  if (forwardedHost) {
    return forwardedHost.split(",")[0].trim();
  }
  return req.headers.host;
}

function getPublicOrigin(req) {
  return `${getPublicProtocol(req)}://${getPublicHost(req)}`;
}

function escapeForJsonUrl(url) {
  return url.replace(/\//g, "\\/");
}

function rewriteTextBody(text, req) {
  const publicOrigin = getPublicOrigin(req);
  const publicHost = getPublicHost(req);
  const escapedPublicOrigin = escapeForJsonUrl(publicOrigin);

  return text
    .replace(/https:\\\/\\\/www\.usdt\.love/g, escapedPublicOrigin)
    .replace(/http:\\\/\\\/www\.usdt\.love/g, escapedPublicOrigin)
    .replace(/https:\/\/www\.usdt\.love/g, publicOrigin)
    .replace(/http:\/\/www\.usdt\.love/g, publicOrigin)
    .replace(/\/\/www\.usdt\.love/g, `//${publicHost}`)
    .replace(/www\.usdt\.love/g, publicHost);
}

function rewriteLocationHeader(location, req) {
  if (!location) return location;

  const publicOrigin = getPublicOrigin(req);
  const publicHost = getPublicHost(req);

  return location
    .replace(/https:\/\/www\.usdt\.love/g, publicOrigin)
    .replace(/http:\/\/www\.usdt\.love/g, publicOrigin)
    .replace(/\/\/www\.usdt\.love/g, `//${publicHost}`)
    .replace(/www\.usdt\.love/g, publicHost);
}

function rewriteSetCookieHeaders(proxyRes) {
  const setCookie = proxyRes.headers["set-cookie"];

  if (!setCookie) return;

  const rewriteCookie = (cookie) => {
    return cookie
      .replace(/;\s*domain=\.?www\.usdt\.love/gi, "")
      .replace(/;\s*domain=\.?usdt\.love/gi, "");
  };

  if (Array.isArray(setCookie)) {
    proxyRes.headers["set-cookie"] = setCookie.map(rewriteCookie);
  } else {
    proxyRes.headers["set-cookie"] = rewriteCookie(setCookie);
  }
}

function cleanSecurityHeaders(proxyRes) {
  delete proxyRes.headers["x-frame-options"];
  delete proxyRes.headers["content-security-policy"];
  delete proxyRes.headers["content-security-policy-report-only"];
  delete proxyRes.headers["strict-transport-security"];
}

function isTextLikeContent(contentType) {
  if (!contentType) return false;

  return (
    contentType.includes("text/html") ||
    contentType.includes("text/css") ||
    contentType.includes("text/plain") ||
    contentType.includes("application/javascript") ||
    contentType.includes("text/javascript") ||
    contentType.includes("application/json") ||
    contentType.includes("application/xml") ||
    contentType.includes("image/svg+xml")
  );
}

const proxy = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  secure: true,
  ws: true,
  xfwd: true,
  followRedirects: false,
  selfHandleResponse: true,

  headers: {
    Host: TARGET_HOST,
    Origin: TARGET,
    Referer: `${TARGET}/`
  },

  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader("Host", TARGET_HOST);
      proxyReq.setHeader("Origin", TARGET);
      proxyReq.setHeader("Referer", `${TARGET}/`);
      proxyReq.setHeader("X-Forwarded-Host", getPublicHost(req));
      proxyReq.setHeader("X-Forwarded-Proto", getPublicProtocol(req));

      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    },

    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      cleanSecurityHeaders(proxyRes);
      rewriteSetCookieHeaders(proxyRes);

      if (proxyRes.headers.location) {
        proxyRes.headers.location = rewriteLocationHeader(proxyRes.headers.location, req);
      }

      const contentType = proxyRes.headers["content-type"] || "";

      if (!isTextLikeContent(contentType)) {
        return responseBuffer;
      }

      const body = responseBuffer.toString("utf8");
      const rewrittenBody = rewriteTextBody(body, req);

      return rewrittenBody;
    }),

    error: (err, req, res) => {
      console.error("Proxy error:", err.message);

      if (!res.headersSent) {
        res.writeHead(502, {
          "Content-Type": "text/plain; charset=utf-8"
        });
      }

      res.end("Proxy Error");
    }
  }
});

app.use("/", proxy);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
