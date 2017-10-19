import xs from 'xstream'


declare function Collection<Passed, Added, Sinks>(
  component: (sources: Passed & Added) => Sinks,
  passedSources: Passed,
  add$: xs<Added>,
  removeSelector: (sinks: Sinks) => xs<any> | void,
  idSelector: (sources: Passed & Added) => string | number | void
): xs<Sinks[]>

declare module Collection {
  function pluck<Sinks, T>(
    items$: xs<Sinks[]>,
    sinkSelector: (sinks: Sinks) => xs<T>
  ): xs<T[]>

  function merge<Sinks, T>(
    items$: xs<Sinks[]>,
    sinkSelector: (sinks: Sinks) => xs<T>
  ): xs<T>

  function gather<Passed, Added, Transformed, Sinks>(
    component: (sources: Passed & Transformed) => Sinks,
    passedSources: Passed,
    itemList$: xs<Added[]>,
    idAttribute?: keyof Added,
    transformKey?: (key: keyof Added) => keyof Transformed
  ): xs<Sinks[]>
}

export default Collection