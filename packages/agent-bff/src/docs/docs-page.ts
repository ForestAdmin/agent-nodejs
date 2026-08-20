/**
 * The page is served WITHOUT credentials, so it must carry no schema: it is an empty shell that asks
 * the caller for a BFF API key, fetches the document with it, and hands the parsed object to Redoc.
 * That is the only design that is both openable in a browser — which sends no header when it
 * navigates — and compatible with a document that is never reachable unauthenticated.
 *
 * The key is never persisted: it is read from the input, passed down as an argument, and the input is
 * cleared. Once the document is fetched the page has no further use for it.
 *
 * Deliberately NOT a `<form>`. A form with no `action` navigates to `/docs?key=<the key>` the moment
 * its default submit is not prevented — a CSP that blocks this inline script is enough — which would
 * put the key in the browser history and in every access log on the way. A form submit is also what
 * Chrome reads as a login, and it then offers to save the key whatever `autocomplete` says. With no
 * form there is no default action to prevent and no submit to observe: without this script the button
 * does nothing at all.
 */
export default function renderDocsPage(documentPath: string, bundlePath: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Forest Admin BFF API</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      #unlock { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 16px; border-bottom: 1px solid #e1e1e1; }
      #unlock label { font-size: 14px; }
      #unlock input { flex: 1 1 280px; padding: 6px 8px; font: inherit; }
      #unlock button { padding: 6px 14px; font: inherit; cursor: pointer; }
      #error { display: none; margin: 16px; padding: 12px; border-left: 3px solid #c00; background: #fff5f5; font-size: 14px; white-space: pre-wrap; }
      #error[data-shown] { display: block; }
    </style>
  </head>
  <body>
    <div id="unlock">
      <label for="key">BFF API key</label>
      <input id="key" type="password" autocomplete="off" spellcheck="false" />
      <button id="load" type="button">Load the API document</button>
    </div>
    <div id="error"></div>
    <div id="redoc"></div>
    <script src="${bundlePath}"></script>
    <script>
      (function () {
        var DOCUMENT_PATH = ${JSON.stringify(documentPath)};
        var BUNDLE_PATH = ${JSON.stringify(bundlePath)};
        var unlock = document.getElementById('unlock');
        var input = document.getElementById('key');
        var button = document.getElementById('load');
        var errorBox = document.getElementById('error');

        function show(message) {
          errorBox.textContent = message;
          errorBox.setAttribute('data-shown', '');
        }

        function hide() {
          errorBox.removeAttribute('data-shown');
        }

        function describe(status, body) {
          var error = body && body.error;

          if (error && error.type) {
            return 'The BFF answered ' + status + ' ' + error.type + ': ' + (error.message || '');
          }

          return 'The BFF answered ' + status + ': ' + JSON.stringify(body);
        }

        /**
         * Kept out of the fetch chain: a throw from here is a viewer problem, and reporting it as
         * "could not reach the document" would point the reader at the wrong thing. \`untrustedSpec\`
         * because the descriptions in the document come from the agent's own schema, and Redoc renders
         * their markdown as HTML — unsanitized unless it is told the spec is untrusted.
         */
        function render(spec) {
          if (typeof Redoc === 'undefined') {
            show('The Redoc viewer did not load from ' + BUNDLE_PATH + ', so the document cannot be rendered.');

            return;
          }

          unlock.style.display = 'none';

          try {
            Redoc.init(
              spec,
              { hideDownloadButton: true, untrustedSpec: true },
              document.getElementById('redoc'),
            );
          } catch (initError) {
            unlock.style.display = '';
            show('The Redoc viewer could not render the document: ' + initError);
          }
        }

        function load(key) {
          hide();

          fetch(DOCUMENT_PATH, {
            cache: 'no-store',
            headers: { 'X-Forest-Bff-Key': key },
          })
            .then(function (response) {
              return response.text().then(function (text) {
                var body;

                try {
                  body = JSON.parse(text);
                } catch (parseError) {
                  body = { error: { type: 'unreadable_response', message: text.slice(0, 200) } };
                }

                return { ok: response.ok, status: response.status, body: body };
              });
            })
            .then(function (result) {
              if (!result.ok) {
                show(describe(result.status, result.body));

                return;
              }

              render(result.body);
            })
            .catch(function (fetchError) {
              show('Could not reach ' + DOCUMENT_PATH + ': ' + fetchError);
            });
        }

        function unlockDocument() {
          var key = input.value.trim();
          input.value = '';

          if (key) load(key);
          else show('A BFF API key is required: the document is never served unauthenticated.');
        }

        button.addEventListener('click', unlockDocument);
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') unlockDocument();
        });
      })();
    </script>
  </body>
</html>
`;
}
