import { type ImgHTMLAttributes, useEffect } from "react";

import styles from "./coreloop.module.css";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

function Image({ src, priority: _priority, ...props }: ImageProps) {
  const normalizedSrc = typeof src === "string" && src.startsWith("/") ? `.${src}` : src;
  return <img {...props} src={normalizedSrc} />;
}

export default function CoreLoop() {
  const stepsData = [
    {
      position: "ql-step-left",
      active: true,
      title: 'Solve the evaluation "Cold Start" problem',
      heading: "Translate unstructured product requirements and specs into verifiable criteria.",
      text: "Convert qualitative goals into verifiable logic.",
    },
    {
      position: "ql-step-right",
      active: true,
      title: "Extract Rubric Aligned Structured Signals",
      heading: "Organize unstructured AI data.",
      text: "Transform AI artifacts (e.g., raw prompts, responses, and traces) into interpretable, rubric-aligned signals.",
    },
    {
      position: "ql-step-left",
      active: false,
      title: "Side-by-Side: Visualize Key Signal Changes",
      heading: "Compare structured signals.",
      text: "Visualize behavior for better interpretability.",
    },
    {
      position: "ql-step-right",
      active: true,
      title: "Verify & Refine",
      heading: "Human in the Loop.",
      text: "Experts verify and calibrate evaluation criteria for scalable oversight.",
    },
    {
      position: "ql-step-left",
      active: true,
      title: "Intelligent Artifact Viewer",
      heading: "Review quality at Scale.",
      list: [
        "Zoom in with an intelligent viewer.",
        "Zoom out for the bigger picture.",
        "Accept, reject, or comment on AI-guidance.",
        "13x speed up in establishing ground truth.",
      ],
    },
    {
      position: "ql-step-right",
      active: false,
      title: "Metrics to Impact",
      heading: "Ensure you're measuring what matters.",
      text: "Navigate and connect large amounts of data.",
    },
    {
      position: "ql-step-wide",
      active: false,
      title: "Collaborate on shared standards",
      heading: "Audit-Ready Reporting.",
      list: [
        "Translate technical logs into business confidence.",
        "Prove safety and compliance to regulators/execs.",
        "Bridge the gap between Subject Matter Experts, PMs, Execs and Engineers.",
        "Solve the information transfer loss between the stakeholders.",
      ],
    },
  ];

  useEffect(() => {
    const steps = document.querySelectorAll<HTMLDivElement>(".ql-step");
    if (!steps.length) return;
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const _scrollDelta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      steps.forEach((step) => {
        const rect = step.getBoundingClientRect();
        const connector = step.querySelector<SVGSVGElement>(".ql-connector-svg");
        if (!connector) return;
        const circle = connector.querySelector<SVGCircleElement>("circle");
        const path = connector.querySelector<SVGPathElement>("path");
        if (!circle || !path) return;
        const totalLength = path.getTotalLength();
        let stepProgress = 1 - Math.min(Math.max(rect.bottom / window.innerHeight, 0), 1);
        stepProgress = Math.min(stepProgress * 1.2, 1);
        const point = path.getPointAtLength(stepProgress * totalLength);
        circle.setAttribute("cx", point.x.toString());
        circle.setAttribute("cy", point.y.toString());
        circle.setAttribute("visibility", stepProgress >= 0.999 ? "hidden" : "visible");
        const index = Array.from(steps).indexOf(step);
        steps.forEach((s, i) => {
          s.classList.remove("is-active", "is-past");
          if (i < index) s.classList.add("is-past");
          if (i === index) s.classList.add("is-active");
        });
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className={`${styles.qualityLoop} section`}>
      <div className={"container"}>
        <div className={`${styles.qualityHeader} text-center`}>
          <h1 className={styles.qualityTitle}>The Quality Core Loop</h1>
          <p className={styles.qualitySubtitle}>
            A workflow to evaluate AI Product Quality.
            <br /> Navigate uncertainty, verify AI guidance, and build trust with stakeholders.
          </p>
        </div>
        <div className={styles.qualityLoopGrid}>
          <div className={styles.qlLeft}>
            <div className={styles.qlLeftBlock}>
              <h4>CODIFY</h4>
              <p>Integrate tacit expert knowledge and taste to define what good is.</p>
              <div className={styles.qlPic}>
                <Image
                  className={styles.qlPicImg}
                  src="/assets/brain.svg"
                  alt="AI Brain"
                  width={300}
                  height={300}
                  priority
                />
              </div>
            </div>

            <div className={styles.qlLeftBlock}>
              <h4>COMPARE</h4>
              <p>Compare models, prompts, and iterations side-by-side.</p>
              <div className={styles.qlPic}>
                <Image
                  className={styles.qlPicImg}
                  src="/assets/docs-compare.svg"
                  alt="Document Comparison"
                  width={300}
                  height={300}
                  priority
                />
              </div>
            </div>

            <div className={styles.qlLeftBlock}>
              <h4>CONNECT</h4>
              <p>Connect evaluation signals to product, compliance, and revenue metrics.</p>
              <div className={styles.qlPic}>
                <Image
                  className={styles.qlPicImg}
                  src="/assets/reports.svg"
                  alt="Reports"
                  width={300}
                  height={300}
                  priority
                />
              </div>
            </div>

            <div className={styles.qlLeftBlock}>
              <h4>COLLABORATE</h4> <p>Communicate effectively with non-technical stakeholders</p>
              <div className={styles.qlPic}>
                <Image
                  className={styles.qlPicImg}
                  src="/assets/collaboration.svg"
                  alt="Collaboration"
                  width={300}
                  height={300}
                  priority
                />
              </div>
            </div>
          </div>
          <div className={styles.qlFlow}>
            <div className={styles.qlFlowCanvas}>
              <div className={styles.qlProgress} />
              <div className={styles.qlProgressNode} id="qlProgressNode" />

              {stepsData.map((step, index) => (
                <div key={step.title} className={`ql-step ${step.position} ${step.active ? "active" : ""}`}>
                  <div className="ql-tab">
                    <Image src="/assets/flow-chart-icon.svg" alt="Chart Icon" width={24} height={24} />
                    {step.title}
                  </div>

                  <div className={`ql-card ${step.active ? "active" : ""}`}>
                    <h5>{step.heading}</h5>
                    <hr className="line-break" />
                    {step.text && <p>{step.text}</p>}
                    {step.list && (
                      <ul>
                        {step.list.map((li) => (
                          <li key={li}>{li}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Only render connector if not the last step */}
                  {index < stepsData.length - 1 && (
                    <div className="ql-card-connector">
                      {step.position === "ql-step-left" && (
                        <svg
                          className="ql-connector-svg"
                          width="87"
                          height="168"
                          viewBox="0 0 87 168"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <title>Connector</title>
                          <path
                            d="M13.0371 0L13.0371 150.86C13.0371 159.697 20.2005 166.86 29.0371 166.86L86.6216 166.86"
                            stroke="#CBCBCB"
                            strokeOpacity="1"
                          />
                          <circle cx="13.0371" cy="0" r="4" fill="#0011EB" stroke="#0011EB" strokeWidth={2} />
                        </svg>
                      )}

                      {step.position === "ql-step-right" && (
                        <svg
                          className="ql-connector-svg"
                          width="87"
                          height="168"
                          viewBox="0 0 87 168"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <title>Connector</title>
                          <path
                            d="M73.5844 0L73.5845 150.86C73.5845 159.697 66.421 166.86 57.5845 166.86L0 166.86"
                            stroke="#CBCBCB"
                            strokeOpacity="1"
                          />
                          <circle cx="73.5845" cy="0" r="4" fill="#0011EB" stroke="#0011EB" strokeWidth={2} />
                        </svg>
                      )}

                      {step.position === "ql-step-wide" && (
                        <svg
                          className="ql-connector-svg"
                          width="87"
                          height="168"
                          viewBox="0 0 87 168"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <title>Connector</title>
                          <path
                            d="M73 0L73 150.86C73 159.697 66 166.86 57 166.86L0 166.86"
                            stroke="#CBCBCB"
                            strokeWidth={2}
                          />
                          <circle cx="73" cy="0" r="7" fill="#1A3F8B" stroke="#1A3F8B" strokeWidth={2} />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className={styles.qlConnectors} aria-hidden />
            </div>
          </div>

          <div className={styles.qlRight}>
            <Image
              className={styles.qlRightImg}
              src="/assets/brain.svg"
              alt="AI Brain"
              width={300}
              height={300}
              priority
            />

            <Image
              className={styles.qlRightImg}
              src="/assets/docs-compare.svg"
              alt="Document Comparison"
              width={300}
              height={300}
              priority
            />
            <Image
              className={styles.qlRightImg}
              src="/assets/reports.svg"
              alt="Reports"
              width={300}
              height={300}
              priority
            />
            <Image
              className={styles.qlRightImg}
              src="/assets/collaboration.svg"
              alt="Collaboration"
              width={300}
              height={300}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
