// FIXME

en gros si on a utilisé un caching data source
-> on doit pouvoir choisir le backend qqpart?
-> on doit pouvoir declarer les relations dans la structure et que ca marche

Si on fait un translating data source
-> on a le choix entre utiser un decorateur (facile, perf bof)
-> ou alors mettre en place la translation pour les relations aussi, sachant que ca veut dire
-> declarer dans la structure
-> /!\ supporter fields relatifs sur les condition tree / sort / projection / aggregation

You may want to implement a data source which exposes multiple collections so that users have no need to manually link the collections together during their agent customization step.

Two strategies are available to achieve that

- Use a decorator

```javascript
const { DataSourceDecorator, JointureDecoratorCollection } = require('@forestadmin/datasource-toolkit');

// Import custom collections that we have defined using either "local-cache" or "query-translation"
// strategy
const



```
