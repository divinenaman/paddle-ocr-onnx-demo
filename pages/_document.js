import { Html, Head, Main, NextScript } from "next/document";

function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* External CDN scripts */}
        <script src="https://docs.opencv.org/4.8.0/opencv.js" async />

        {/* Local scripts from public folder */}
        <script src="/js/opencv.js" />
        <script src="/js/utilities.js" />

        {/* Meta tags, fonts, etc. */}
        <meta name="description" content="My Next.js app" />
        <link rel="icon" href="/favicon.ico" />

        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />

        {/* Inline script for initialization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Global initialization
              window.onOpenCVReady = function() {
                console.log('OpenCV is ready to use');
                window.cvReady = true;
              };
              
              // Check if OpenCV is already loaded
              if (window.cv && window.cv.Mat) {
                window.cvReady = true;
              }
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

export default Document;
