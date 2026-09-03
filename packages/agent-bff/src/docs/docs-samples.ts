import { BFF_KEY_HEADER } from '../api-key/api-key-middleware';
import { TIMEZONE_HEADER } from '../timezone/timezone-middleware';

/** Neutral and always valid, where a local zone would only be right for whoever generated it. */
const SAMPLE_TIMEZONE = 'UTC';
const KEY_VARIABLE = 'BFF_KEY';
const SESSION_VARIABLE = 'BFF_SESSION';

/**
 * Browser source, injected into the page: it decorates the fetched document with `x-codeSamples`,
 * which Redoc renders as one tab per language, then hands it to `Redoc.init`.
 *
 * In the page rather than in the document, deliberately. Three samples per operation weigh ~73 KB on
 * a 16-collection schema and several hundred KB on a large one, which every consumer of
 * `/agent/openapi.json` would pay for an extension only a viewer reads — where this costs one
 * function whatever the operation count. It also lets a sample carry the REAL origin: the document
 * declares `servers` root-relative unless `BFF_PUBLIC_URL` is set, so a sample built into it could
 * only hold a placeholder host, while the page knows where it is served from and emits a command
 * that runs as pasted.
 *
 * The key is never inlined: each language reads it from the environment, so a copied sample cannot
 * carry a credential into a shell history or a paste.
 *
 * Everything else is read from the document rather than assumed: the auth header comes from the
 * security scheme the operation names, and the body carries exactly the properties its request
 * schema makes required — `parentId` for a relation, `recordIds` for an action, nothing at all for a
 * list, whose body is optional. The one header that cannot be read off an operation is the timezone,
 * a component-level parameter reference; resolving it would buy nothing, since omitting it is a 400
 * (`resolveTimezone` throws `missing_timezone` when header, body field and deployment default are
 * all absent) and that is precisely what a hand-written sample forgets.
 */
const SAMPLES_SCRIPT = `
        var KEY_HEADER = ${JSON.stringify(BFF_KEY_HEADER)};
        var TIMEZONE_HEADER = ${JSON.stringify(TIMEZONE_HEADER)};
        var SAMPLE_TIMEZONE = ${JSON.stringify(SAMPLE_TIMEZONE)};
        var KEY_VARIABLE = ${JSON.stringify(KEY_VARIABLE)};
        var SESSION_VARIABLE = ${JSON.stringify(SESSION_VARIABLE)};

        /**
         * Every walk below is depth-bounded, because a document can reference itself: a filter is a
         * condition TREE, and nothing stops a \`$ref\` or an \`allOf\` from naming its own schema. An
         * overflow here is not local — it throws out of the decoration, so every operation after the
         * offending one loses its samples too.
         */
        var MAX_DEPTH = 6;

        function schemaOf(spec, node, depth) {
          if (!node || depth > MAX_DEPTH) return {};

          if (node.$ref) {
            var schemas = (spec.components || {}).schemas || {};

            return schemaOf(spec, schemas[node.$ref.split('/').pop()], depth + 1);
          }

          return node;
        }

        // A relation request is its foreign collection request plus a parent id, expressed as allOf.
        function flatten(spec, node, depth) {
          var schema = schemaOf(spec, node, depth);

          if (!schema.allOf || depth > MAX_DEPTH) return schema;

          var merged = { properties: {}, required: [] };

          schema.allOf.forEach(function (part) {
            var flat = flatten(spec, part, depth + 1);

            Object.keys(flat.properties || {}).forEach(function (name) {
              merged.properties[name] = flat.properties[name];
            });
            merged.required = merged.required.concat(flat.required || []);
          });

          return merged;
        }

        function placeholder(spec, name, node, depth) {
          if (depth > MAX_DEPTH) return '<' + name + '>';

          var schema = schemaOf(spec, node, depth);
          var alternatives = schema.anyOf || schema.oneOf;

          if (alternatives && alternatives.length) {
            return placeholder(spec, name, alternatives[0], depth + 1);
          }

          if (schema.enum && schema.enum.length) return schema.enum[0];
          if (schema.type === 'array') return [placeholder(spec, name, schema.items, depth + 1)];
          if (schema.type === 'number' || schema.type === 'integer') return 0;
          if (schema.type === 'boolean') return true;
          if (schema.type === 'object') return {};

          return '<' + name + '>';
        }

        function exampleBody(spec, operation) {
          var content = ((operation.requestBody || {}).content || {})['application/json'];

          if (!content) return undefined;

          var schema = flatten(spec, content.schema, 0);
          var body = {};

          (schema.required || []).forEach(function (name) {
            body[name] = placeholder(spec, name, (schema.properties || {})[name], 0);
          });

          return body;
        }

        // The page only ever unlocks with the API key, so it wins wherever an operation takes it. A
        // session-only operation samples the bearer it names, under its OWN variable: that route
        // answers 403 oauth_required to an API key, so reusing the unlock secret would emit a
        // command that cannot work.
        function authHeader(spec, operation) {
          var schemes = (spec.components || {}).securitySchemes || {};
          var requirements = operation.security || spec.security || [];
          var apiKey = null;
          var bearer = null;

          requirements.forEach(function (requirement) {
            Object.keys(requirement).forEach(function (name) {
              var scheme = schemes[name] || {};

              if (scheme.type === 'apiKey' && scheme.in === 'header') {
                apiKey = { name: scheme.name, prefix: '', variable: KEY_VARIABLE };
              } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
                bearer = { name: 'Authorization', prefix: 'Bearer ', variable: SESSION_VARIABLE };
              }
            });
          });

          return apiKey || bearer || { name: KEY_HEADER, prefix: '', variable: KEY_VARIABLE };
        }

        /**
         * The unfolded document has no path parameter left — its segments are the real names, already
         * URL-encoded — but the generic one is all templates, and a sample cannot be made to invoke
         * those: the generic document is served precisely BECAUSE the deployment cannot enumerate its
         * collections, so there is no real name to substitute. Inventing one would read as runnable
         * and answer 404. Each template becomes the same \`<name>\` placeholder the bodies use, so one
         * notation across a snippet means "replace this" and none of it looks like API syntax.
         */
        function samplePath(spec, item, operation, path) {
          var parameters = (item.parameters || []).concat(operation.parameters || []);
          var components = (spec.components || {}).parameters || {};
          var sampled = path;

          parameters.forEach(function (parameter) {
            var declared = parameter && parameter.$ref
              ? components[parameter.$ref.split('/').pop()] || {}
              : parameter || {};

            if (declared.in !== 'path' || !declared.name) return;

            sampled = sampled.split('{' + declared.name + '}').join('<' + declared.name + '>');
          });

          return sampled;
        }

        function headersOf(spec, operation, body) {
          var headers = [authHeader(spec, operation)];

          headers.push({ name: TIMEZONE_HEADER, value: SAMPLE_TIMEZONE });

          if (body !== undefined) headers.push({ name: 'Content-Type', value: 'application/json' });

          return headers;
        }

        /**
         * A collection or action name reaches these samples with its apostrophes intact:
         * \`encodeURIComponent\` leaves \`'\` alone, so a collection called \`John's orders\` is a path
         * segment carrying one, and a field name or enum value can carry one into a body. Every
         * interpolation therefore goes through the quoting of its target language.
         */
        function shellQuoted(value) {
          return "'" + String(value).split("'").join("'\\\\''") + "'";
        }

        // For a value that must EXPAND: single quotes would send the literal '$BFF_KEY' and earn a
        // 401. Only fixed text is ever placed here, but it is escaped for the context regardless.
        function shellExpanding(text) {
          return String(text).replace(/([\\\\"\`$])/g, '\\\\$1');
        }

        function rubyQuoted(value) {
          return "'" + String(value).replace(/\\\\/g, '\\\\\\\\').split("'").join("\\\\'") + "'";
        }

        // Ruby interpolates #{...} inside double quotes, and a JSON literal is double-quoted.
        function rubySafeJson(text) {
          return String(text).split('#{').join('\\\\#{');
        }

        function curlSample(url, method, headers, body) {
          var lines = ['curl -X ' + method + ' ' + shellQuoted(url)];

          headers.forEach(function (header) {
            if (header.variable) {
              var expanded =
                shellExpanding(header.name) +
                ': ' +
                shellExpanding(header.prefix) +
                '$' +
                header.variable;

              lines.push('  -H "' + expanded + '"');

              return;
            }

            lines.push('  -H ' + shellQuoted(header.name + ': ' + header.value));
          });

          if (body !== undefined) lines.push('  -d ' + shellQuoted(JSON.stringify(body)));

          return lines.join(' \\\\\\n');
        }

        function nodeSample(url, method, headers, body) {
          var lines = [
            'const response = await fetch(' + JSON.stringify(url) + ', {',
            '  method: ' + JSON.stringify(method) + ',',
            '  headers: {',
          ];

          headers.forEach(function (header) {
            var value = header.variable
              ? (header.prefix ? JSON.stringify(header.prefix) + ' + ' : '') +
                'process.env.' +
                header.variable
              : JSON.stringify(header.value);

            lines.push('    ' + JSON.stringify(header.name) + ': ' + value + ',');
          });

          lines.push('  },');

          if (body !== undefined) {
            lines.push('  body: JSON.stringify(' + JSON.stringify(body) + '),');
          }

          lines.push('});');
          lines.push('');
          lines.push(
            "if (!response.ok) throw new Error(response.status + ' ' + (await response.text()));",
          );
          lines.push('');
          lines.push('console.log(await response.json());');

          return lines.join('\\n');
        }

        function rubySample(url, method, headers, body) {
          var verb = method.charAt(0) + method.slice(1).toLowerCase();
          var lines = [
            "require 'json'",
            "require 'net/http'",
            '',
            'uri = URI(' + rubyQuoted(url) + ')',
            'request = Net::HTTP::' + verb + '.new(uri)',
          ];

          headers.forEach(function (header) {
            if (!header.variable) {
              lines.push('request[' + rubyQuoted(header.name) + '] = ' + rubyQuoted(header.value));

              return;
            }

            var read = "ENV.fetch('" + header.variable + "')";
            var value = header.prefix ? '"' + header.prefix + '#{' + read + '}"' : read;

            lines.push('request[' + rubyQuoted(header.name) + '] = ' + value);
          });

          if (body !== undefined) {
            lines.push('request.body = JSON.generate(' + rubySafeJson(JSON.stringify(body)) + ')');
          }

          lines.push('');
          lines.push(
            "response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|",
          );
          lines.push('  http.request(request)');
          lines.push('end');
          lines.push('');
          lines.push('puts response.body');

          return lines.join('\\n');
        }

        function decorateWithSamples(spec, origin) {
          var paths = spec.paths || {};

          Object.keys(paths).forEach(function (path) {
            var item = paths[path] || {};

            Object.keys(item).forEach(function (method) {
              var operation = item[method];

              if (!operation || typeof operation !== 'object' || !operation.responses) return;

              var body = exampleBody(spec, operation);
              var headers = headersOf(spec, operation, body);
              var url = origin + samplePath(spec, item, operation, path);
              var verb = method.toUpperCase();

              operation['x-codeSamples'] = [
                { lang: 'cURL', source: curlSample(url, verb, headers, body) },
                { lang: 'JavaScript', source: nodeSample(url, verb, headers, body) },
                { lang: 'Ruby', source: rubySample(url, verb, headers, body) },
              ];
            });
          });

          return spec;
        }

        /**
         * Samples are a convenience; the document is the point. A shape the generator cannot walk
         * costs the reader its snippets, never the page — and reporting it as a Redoc render failure
         * would send them looking in the wrong place.
         */
        function withSamples(spec) {
          try {
            return decorateWithSamples(spec, window.location.origin);
          } catch (samplesError) {
            return spec;
          }
        }
`;

export default SAMPLES_SCRIPT;
