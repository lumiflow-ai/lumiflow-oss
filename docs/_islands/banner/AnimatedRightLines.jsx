"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

const WhileInViewdRightLines = () => {
  const [circles, setCircles] = useState([]);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const checkSafari = () => {
      const userAgent = navigator.userAgent;
      const vendor = navigator.vendor;
      const isSafariBrowser = vendor.includes("Apple") && userAgent.includes("Safari") && !userAgent.includes("Chrome");

      setIsSafari(isSafariBrowser);
    };

    checkSafari();
    const generateCircles = () => {
      const newCircles = [];
      const numCircles = 10;
      for (let i = 0; i < numCircles; i++) {
        const delay = Math.random() * (6 - 2) + 2;
        newCircles.push(delay);
      }
      setCircles(newCircles);
    };

    generateCircles();
  }, []);

  return (
    <div className="animated-right-lines" style={{ justifyContent: "flex-end" }}>
      <div className="animated-right-lines-div">
        <svg
          style={{ overflow: "visible", padding: "20px 0px", width: "43vw" }}
          viewBox="0 0 805 502"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          {isSafari === true ? (
            <>
              <path
                id="pathR1"
                d="M804.237 1H440.902C418.81 1 400.902 18.9086 400.902 41V112.07C400.902 134.161 382.993 152.07 360.902 152.07H0.241771"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR2"
                d="M804.237 501H376.689C354.598 501 336.689 483.091 336.689 461V389.93C336.689 367.839 318.781 349.93 296.689 349.93H0.241771"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR3"
                d="M805 17.0415H311.98C294.306 17.0415 279.98 31.3684 279.98 49.0415V136.112C279.98 153.785 265.653 168.112 247.98 168.112H0"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR4"
                d="M804.5 484.958H320.416C298.324 484.958 280.416 467.049 280.416 444.958V373.888C280.416 351.797 262.507 333.888 240.416 333.888H0.5"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR5"
                d="M804.237 42.4441L477.836 41.2201C461.224 41.1578 447.723 54.6074 447.723 71.2199V162.267C447.723 178.8 434.347 192.217 417.813 192.267L0.241771 193.514"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR6"
                d="M804.237 459.558L675.965 460.639C659.299 460.78 645.712 447.308 645.712 430.64V339.762C645.712 323.218 632.319 309.797 615.775 309.763L0.241771 308.488"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR7"
                d="M804.237 66.5078L552.781 65.314C536.157 65.2351 522.638 78.6895 522.638 95.3137V186.318C522.638 202.856 509.253 216.275 492.715 216.317L0.241771 217.578"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR8"
                d="M804.237 349.931L493.223 351.171C479.931 351.224 469.128 340.464 469.128 327.172V309.691C469.128 296.463 458.424 285.729 445.196 285.691L0.241771 284.422"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR9"
                d="M804.237 89.2353L354.056 88.0078C331.922 87.9475 313.947 105.874 313.947 128.008V199.139C313.947 221.163 296.142 239.044 274.118 239.138L0.241771 240.305"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
              <path
                id="pathR10"
                d="M804.237 412.766L439.696 413.97C417.553 414.043 399.564 396.113 399.564 373.97V302.899C399.564 280.86 381.737 262.973 359.698 262.899L0.241771 261.696"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
              />
            </>
          ) : (
            <>
              <motion.path
                id="pathR1"
                d="M804.237 1H440.902C418.81 1 400.902 18.9086 400.902 41V112.07C400.902 134.161 382.993 152.07 360.902 152.07H0.241771"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR2"
                d="M804.237 501H376.689C354.598 501 336.689 483.091 336.689 461V389.93C336.689 367.839 318.781 349.93 296.689 349.93H0.241771"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR3"
                d="M805 17.0415H311.98C294.306 17.0415 279.98 31.3684 279.98 49.0415V136.112C279.98 153.785 265.653 168.112 247.98 168.112H0"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.2,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR4"
                d="M804.5 484.958H320.416C298.324 484.958 280.416 467.049 280.416 444.958V373.888C280.416 351.797 262.507 333.888 240.416 333.888H0.5"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.2,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR5"
                d="M804.237 42.4441L477.836 41.2201C461.224 41.1578 447.723 54.6074 447.723 71.2199V162.267C447.723 178.8 434.347 192.217 417.813 192.267L0.241771 193.514"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.3,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR6"
                d="M804.237 459.558L675.965 460.639C659.299 460.78 645.712 447.308 645.712 430.64V339.762C645.712 323.218 632.319 309.797 615.775 309.763L0.241771 308.488"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.3,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR7"
                d="M804.237 66.5078L552.781 65.314C536.157 65.2351 522.638 78.6895 522.638 95.3137V186.318C522.638 202.856 509.253 216.275 492.715 216.317L0.241771 217.578"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.4,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR8"
                d="M804.237 349.931L493.223 351.171C479.931 351.224 469.128 340.464 469.128 327.172V309.691C469.128 296.463 458.424 285.729 445.196 285.691L0.241771 284.422"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.5,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR9"
                d="M804.237 89.2353L354.056 88.0078C331.922 87.9475 313.947 105.874 313.947 128.008V199.139C313.947 221.163 296.142 239.044 274.118 239.138L0.241771 240.305"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.5,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
              <motion.path
                id="pathR10"
                d="M804.237 412.766L439.696 413.97C417.553 414.043 399.564 396.113 399.564 373.97V302.899C399.564 280.86 381.737 262.973 359.698 262.899L0.241771 261.696"
                stroke="url(#paint9_linear_23502_445)"
                strokeWidth="2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                  transition: {
                    pathLength: {
                      delay: 0.4,
                      type: "spring",
                      duration: 3,
                    },
                  },
                }}
              />
            </>
          )}
          {circles.map((delay, index) => {
            const tempId = index + 1;
            return (
              <circle key={`Pth${tempId}`} cx="0" cy="0" r="4" fill="#0011EB">
                <animate
                  attributeName="opacity"
                  begin={`${delay + 5}s`}
                  dur="3s"
                  repeatCount="indefinite"
                  values="0;1;1;0"
                  keyTimes="0;0.1;0.71;0"
                />
                <animateMotion
                  begin={`${delay + 5}s`}
                  dur="5s"
                  repeatCount="indefinite"
                  keyPoints="1;0"
                  keyTimes="0;1"
                  calcMode="linear"
                >
                  <mpath href={`#pathR${tempId}`} />
                </animateMotion>
              </circle>
            );
          })}

          <defs>
            <linearGradient
              id="paint9_linear_23502_445"
              x1="0.00738525"
              y1="412.264"
              x2="803.976"
              y2="412.264"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0.5" stopColor="#0D0D0D" />
              <stop offset="1" stopColor="white" />
            </linearGradient>
            <linearGradient
              id="paint10_linear_352_28487"
              x1="263"
              y1="312"
              x2="147"
              y2="312"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#084F35" />
              <stop offset="1" stopColor="#20A072" />
            </linearGradient>

            <linearGradient
              id="paint11_linear_352_28487"
              x1="387"
              y1="16"
              x2="329"
              y2="16"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#084F35" />
              <stop offset="1" stopColor="#20A072" />
            </linearGradient>
            <linearGradient
              id="paint12_linear_352_28487"
              x1="186"
              y1="69"
              x2="65"
              y2="69"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#084F35" />
              <stop offset="1" stopColor="#20A072" />
            </linearGradient>
            <linearGradient
              id="paint13_linear_352_28487"
              x1="460"
              y1="265"
              x2="368"
              y2="265"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#084F35" />
              <stop offset="1" stopColor="#20A072" />
            </linearGradient>
            <linearGradient
              id="paint14_linear_352_28487"
              x1="455"
              y1="364"
              x2="363"
              y2="364"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#084F35" />
              <stop offset="1" stopColor="#20A072" />
            </linearGradient>
          </defs>
          <defs>
            <linearGradient id="shimmerGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1E3E33" stopOpacity="1" />
              <stop offset="50%" stopColor="#4CAF50" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1E3E33" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

export default WhileInViewdRightLines;
