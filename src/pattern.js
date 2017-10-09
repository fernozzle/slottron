const pattern = {}

pattern.parse = function(template) {
  const varNames = []
  const [fixedParts, ...pairs] =
    template.split('<').map(s => s.split('>'))
  for (const [varName, fixedPart] of pairs) {
    fixedParts.push(fixedPart)
    varNames.push(varName)
  }
  return {fixedParts, varNames}
}
function varPart(dict, key) {
  if (!key) return ''
  const value = dict[key]
  return (value !== undefined) ? value : `<${key}>`
}
pattern.render = function({fixedParts, varNames}, dict) {
  return fixedParts.map((fixedPart, i) =>
    fixedPart + varPart(dict, varNames[i])
  ).join('')
}
pattern.read = function({fixedParts, varNames}, path) {
  const dict = {}
  let index = 0

  // at the very least, the beginnings gotta match up
  if (path.indexOf(fixedParts[0]) !== index) throw `Beginnings don't line up`
  index += fixedParts[0].length

  // skipped if there are no variables!
  for (let i = 0; i < varNames.length; i++) {

    // search from the end if next fixedPart is the last
    let varEnd = (i + 1 === fixedParts.length - 1)
      ? path.lastIndexOf(fixedParts[i + 1])
      : path.indexOf    (fixedParts[i + 1], index)
    if (varEnd <= index) throw `Fixed part "${fixedParts[i + 1]}" unfound or behind us, with value ${varEnd}`
    if (varNames[i] !== '*') { // {*} means 'throw it away'
      dict[varNames[i]] = path.substring(index, varEnd)
    }
    // skip over the fixedPart, which we know matches up
    index = varEnd + fixedParts[i + 1].length
  }

  return dict
}
pattern.renderDummy = function(parsed) {
  const dict = {}
  for (name of parsed.varNames) dict[name] = '___'
  return pattern.render(parsed, dict)
}

/*
const parsed = pattern.parse('cool-art-{title}-hires.png')
console.log('it is HEEERE', parsed)
const rendered = pattern.render(parsed, {id: 'fakeid', title: 'great-renaissance'})
console.log('now RENDERED', rendered)
const dict = pattern.read(parsed, rendered)
console.log('now READ', dict)
*/

module.exports = pattern
