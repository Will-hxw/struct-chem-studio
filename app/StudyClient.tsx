"use client";
import { useEffect, useState } from "react";
export default function Home({
  scope,
  scriptUrl,
}: {
  scope: string;
  scriptUrl: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = scriptUrl;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [scriptUrl]);
  return (
    <div id="studio" data-scope={scope}>
      {failed ? (
        <main className="loading">
          <p>页面资源未能载入，请检查网络。</p>
          <button className="btn" onClick={() => location.reload()}>
            重新载入
          </button>
        </main>
      ) : (
        <main
          className="study-opening"
          aria-busy="true"
          aria-label="正在读取学习进度"
        >
          <div className="opening-brand">
            <img src="/favicon.svg" alt="" width="36" height="36" />
            结构化学
          </div>
          <div className="opening-content">
            <h1>复习工作台</h1>
            <div className="opening-card" />
            <div className="opening-stats" />
          </div>
        </main>
      )}
    </div>
  );
}
