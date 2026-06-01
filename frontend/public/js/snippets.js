'use strict';
/* =============================================================
   UNIVERSAL SNIPPET + AUTOCOMPLETE ENGINE
   Registers completion providers for every Monaco language.
   Works like VS Code: type a trigger word → pick suggestion →
   Enter expands the full structure with cursor placement.
   ============================================================= */

const SnippetEngine = {

  // ---- Snippet definitions per language ----------------------
  _snippets: {

    // ---- HTML ------------------------------------------------
    html: [
      { label:'!', detail:'HTML5 boilerplate', insert:'<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${2}\n</body>\n</html>' },
      { label:'div', detail:'<div>', insert:'<div class="${1}">\n  ${2}\n</div>' },
      { label:'span', detail:'<span>', insert:'<span class="${1}">${2}</span>' },
      { label:'p', detail:'<p>', insert:'<p>${1}</p>' },
      { label:'a', detail:'<a href>', insert:'<a href="${1:#}">${2:link}</a>' },
      { label:'img', detail:'<img>', insert:'<img src="${1}" alt="${2}" />' },
      { label:'ul', detail:'<ul>', insert:'<ul>\n  <li>${1}</li>\n</ul>' },
      { label:'ol', detail:'<ol>', insert:'<ol>\n  <li>${1}</li>\n</ol>' },
      { label:'li', detail:'<li>', insert:'<li>${1}</li>' },
      { label:'form', detail:'<form>', insert:'<form action="${1}" method="${2:post}">\n  ${3}\n  <button type="submit">${4:Submit}</button>\n</form>' },
      { label:'input', detail:'<input>', insert:'<input type="${1:text}" name="${2}" placeholder="${3}" />' },
      { label:'button', detail:'<button>', insert:'<button type="${1:button}">${2:Click me}</button>' },
      { label:'table', detail:'<table>', insert:'<table>\n  <thead>\n    <tr>\n      <th>${1:Header}</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>${2:Cell}</td>\n    </tr>\n  </tbody>\n</table>' },
      { label:'section', detail:'<section>', insert:'<section class="${1}">\n  ${2}\n</section>' },
      { label:'article', detail:'<article>', insert:'<article>\n  <h2>${1:Title}</h2>\n  <p>${2}</p>\n</article>' },
      { label:'nav', detail:'<nav>', insert:'<nav>\n  ${1}\n</nav>' },
      { label:'header', detail:'<header>', insert:'<header>\n  ${1}\n</header>' },
      { label:'footer', detail:'<footer>', insert:'<footer>\n  ${1}\n</footer>' },
      { label:'main', detail:'<main>', insert:'<main>\n  ${1}\n</main>' },
      { label:'link', detail:'<link rel="stylesheet">', insert:'<link rel="stylesheet" href="${1:style.css}" />' },
      { label:'script', detail:'<script src>', insert:'<script src="${1}"></script>' },
      { label:'meta', detail:'<meta name>', insert:'<meta name="${1}" content="${2}" />' },
      { label:'h1', detail:'<h1>', insert:'<h1>${1}</h1>' },
      { label:'h2', detail:'<h2>', insert:'<h2>${1}</h2>' },
      { label:'h3', detail:'<h3>', insert:'<h3>${1}</h3>' },
      { label:'label', detail:'<label>', insert:'<label for="${1}">${2}</label>' },
      { label:'select', detail:'<select>', insert:'<select name="${1}">\n  <option value="${2}">${3}</option>\n</select>' },
      { label:'textarea', detail:'<textarea>', insert:'<textarea name="${1}" rows="${2:4}" cols="${3:50}">${4}</textarea>' },
      { label:'video', detail:'<video>', insert:'<video src="${1}" controls>\n  Your browser does not support video.\n</video>' },
      { label:'audio', detail:'<audio>', insert:'<audio src="${1}" controls></audio>' },
      { label:'canvas', detail:'<canvas>', insert:'<canvas id="${1}" width="${2:800}" height="${3:600}"></canvas>' },
      { label:'svg', detail:'<svg>', insert:'<svg xmlns="http://www.w3.org/2000/svg" width="${1:24}" height="${2:24}" viewBox="0 0 ${1:24} ${2:24}">\n  ${3}\n</svg>' },
    ],

    // ---- CSS / SCSS / LESS ------------------------------------
    css: [
      { label:'flex', detail:'display:flex', insert:'display: flex;\nalign-items: ${1:center};\njustify-content: ${2:center};' },
      { label:'grid', detail:'display:grid', insert:'display: grid;\ngrid-template-columns: ${1:repeat(3,1fr)};\ngap: ${2:1rem};' },
      { label:'media', detail:'@media query', insert:'@media (max-width: ${1:768px}) {\n  ${2}\n}' },
      { label:'var', detail:'CSS variable', insert:'--${1:name}: ${2:value};' },
      { label:'animation', detail:'@keyframes', insert:'@keyframes ${1:name} {\n  from { ${2} }\n  to { ${3} }\n}' },
      { label:'anim', detail:'animation property', insert:'animation: ${1:name} ${2:0.3s} ${3:ease} ${4:forwards};' },
      { label:'trans', detail:'transition', insert:'transition: ${1:all} ${2:0.3s} ${3:ease};' },
      { label:'abs', detail:'position:absolute', insert:'position: absolute;\ntop: ${1:0};\nleft: ${2:0};' },
      { label:'fix', detail:'position:fixed', insert:'position: fixed;\ntop: ${1:0};\nleft: ${2:0};\nright: 0;\nbottom: 0;' },
      { label:'center', detail:'center absolutely', insert:'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);' },
      { label:'shadow', detail:'box-shadow', insert:'box-shadow: ${1:0} ${2:4px} ${3:16px} ${4:rgba(0,0,0,0.15)};' },
      { label:'radius', detail:'border-radius', insert:'border-radius: ${1:8px};' },
      { label:'scroll', detail:'overflow scroll', insert:'overflow: auto;\n-webkit-overflow-scrolling: touch;' },
      { label:'clamp', detail:'clamp()', insert:'clamp(${1:1rem}, ${2:4vw}, ${3:2rem})' },
      { label:'root', detail:':root variables', insert:':root {\n  --${1:primary}: ${2:#7c3aed};\n  --${3:bg}: ${4:#0a0a0f};\n}' },
    ],

    // ---- JavaScript ------------------------------------------
    javascript: [
      { label:'cl', detail:'console.log', insert:'console.log(${1})' },
      { label:'fn', detail:'function', insert:'function ${1:name}(${2}) {\n  ${3}\n}' },
      { label:'afn', detail:'async function', insert:'async function ${1:name}(${2}) {\n  ${3}\n}' },
      { label:'arr', detail:'arrow function', insert:'const ${1:fn} = (${2}) => {\n  ${3}\n};' },
      { label:'aarr', detail:'async arrow function', insert:'const ${1:fn} = async (${2}) => {\n  ${3}\n};' },
      { label:'const', detail:'const declaration', insert:'const ${1:name} = ${2};' },
      { label:'let', detail:'let declaration', insert:'let ${1:name} = ${2};' },
      { label:'fetch', detail:'fetch API', insert:"const res = await fetch('${1:url}');\nconst data = await res.json();\n${2}" },
      { label:'try', detail:'try/catch', insert:'try {\n  ${1}\n} catch (${2:err}) {\n  console.error(${2:err});\n}' },
      { label:'class', detail:'ES6 class', insert:'class ${1:Name} {\n  constructor(${2}) {\n    ${3}\n  }\n\n  ${4:method}() {\n    ${5}\n  }\n}' },
      { label:'imp', detail:'import', insert:"import { ${1} } from '${2}';" },
      { label:'exp', detail:'export default', insert:'export default ${1};' },
      { label:'qs', detail:'querySelector', insert:"document.querySelector('${1}');" },
      { label:'qsa', detail:'querySelectorAll', insert:"document.querySelectorAll('${1}').forEach(${2:el} => {\n  ${3}\n});" },
      { label:'ael', detail:'addEventListener', insert:"${1:element}.addEventListener('${2:click}', (${3:e}) => {\n  ${4}\n});" },
      { label:'prom', detail:'Promise', insert:'new Promise((resolve, reject) => {\n  ${1}\n})' },
      { label:'for', detail:'for loop', insert:'for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n  ${3}\n}' },
      { label:'fof', detail:'for...of', insert:'for (const ${1:item} of ${2:items}) {\n  ${3}\n}' },
      { label:'fin', detail:'for...in', insert:'for (const ${1:key} in ${2:obj}) {\n  ${3}\n}' },
      { label:'sw', detail:'switch', insert:'switch (${1:expr}) {\n  case ${2:val}:\n    ${3}\n    break;\n  default:\n    ${4}\n}' },
      { label:'stor', detail:'localStorage', insert:"localStorage.setItem('${1:key}', JSON.stringify(${2:value}));" },
      { label:'stoget', detail:'localStorage.getItem', insert:"JSON.parse(localStorage.getItem('${1:key}'));" },
      { label:'tmout', detail:'setTimeout', insert:'setTimeout(() => {\n  ${1}\n}, ${2:1000});' },
      { label:'tint', detail:'setInterval', insert:'setInterval(() => {\n  ${1}\n}, ${2:1000});' },
    ],

    // ---- TypeScript ------------------------------------------
    typescript: [
      { label:'int', detail:'interface', insert:'interface ${1:Name} {\n  ${2:prop}: ${3:string};\n}' },
      { label:'type', detail:'type alias', insert:'type ${1:Name} = {\n  ${2:prop}: ${3:string};\n};' },
      { label:'enum', detail:'enum', insert:'enum ${1:Name} {\n  ${2:Value1},\n  ${3:Value2},\n}' },
      { label:'gen', detail:'generic function', insert:'function ${1:name}<${2:T}>(${3:arg}: ${2:T}): ${2:T} {\n  return ${3:arg};\n}' },
      { label:'afn', detail:'async function typed', insert:'async function ${1:name}(${2}): Promise<${3:void}> {\n  ${4}\n}' },
    ],

    // ---- Python ----------------------------------------------
    python: [
      { label:'def', detail:'function', insert:'def ${1:name}(${2}):\n    ${3:pass}' },
      { label:'class', detail:'class', insert:'class ${1:Name}:\n    def __init__(self${2}):\n        ${3:pass}' },
      { label:'if', detail:'if/elif/else', insert:'if ${1:condition}:\n    ${2}\nelif ${3:condition}:\n    ${4}\nelse:\n    ${5}' },
      { label:'for', detail:'for loop', insert:'for ${1:item} in ${2:iterable}:\n    ${3}' },
      { label:'while', detail:'while loop', insert:'while ${1:condition}:\n    ${2}' },
      { label:'try', detail:'try/except', insert:'try:\n    ${1}\nexcept ${2:Exception} as ${3:e}:\n    ${4}' },
      { label:'with', detail:'with statement', insert:'with ${1:open("${2:file}")} as ${3:f}:\n    ${4}' },
      { label:'pr', detail:'print()', insert:'print(${1})' },
      { label:'imp', detail:'import', insert:'import ${1}' },
      { label:'from', detail:'from import', insert:'from ${1} import ${2}' },
      { label:'lc', detail:'list comprehension', insert:'[${1:expr} for ${2:item} in ${3:iterable}]' },
      { label:'dc', detail:'dict comprehension', insert:'{${1:k}: ${2:v} for ${1:k}, ${2:v} in ${3:items}.items()}' },
      { label:'lambda', detail:'lambda', insert:'lambda ${1:args}: ${2:expr}' },
      { label:'main', detail:'if __name__', insert:'if __name__ == "__main__":\n    ${1:main()}' },
      { label:'deco', detail:'decorator', insert:'@${1:decorator}\ndef ${2:func}(${3}):\n    ${4}' },
    ],

    // ---- Java ------------------------------------------------
    java: [
      { label:'main', detail:'main method', insert:'public static void main(String[] args) {\n    ${1}\n}' },
      { label:'class', detail:'class', insert:'public class ${1:Name} {\n    ${2}\n}' },
      { label:'sout', detail:'System.out.println', insert:'System.out.println(${1});' },
      { label:'for', detail:'for loop', insert:'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}' },
      { label:'foreach', detail:'for-each', insert:'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4}\n}' },
      { label:'if', detail:'if/else', insert:'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}' },
      { label:'try', detail:'try/catch', insert:'try {\n    ${1}\n} catch (${2:Exception} ${3:e}) {\n    e.printStackTrace();\n}' },
      { label:'interface', detail:'interface', insert:'public interface ${1:Name} {\n    ${2}\n}' },
      { label:'arr', detail:'array', insert:'${1:String}[] ${2:arr} = new ${1:String}[${3:10}];' },
      { label:'list', detail:'ArrayList', insert:'List<${1:String}> ${2:list} = new ArrayList<>();' },
      { label:'map', detail:'HashMap', insert:'Map<${1:String}, ${2:Object}> ${3:map} = new HashMap<>();' },
    ],

    // ---- C / C++ ---------------------------------------------
    c: [
      { label:'main', detail:'main function', insert:'int main(int argc, char *argv[]) {\n    ${1}\n    return 0;\n}' },
      { label:'pr', detail:'printf', insert:'printf("${1}\\n"${2});' },
      { label:'inc', detail:'#include', insert:'#include <${1:stdio.h}>' },
      { label:'for', detail:'for loop', insert:'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3}\n}' },
      { label:'while', detail:'while loop', insert:'while (${1:condition}) {\n    ${2}\n}' },
      { label:'struct', detail:'struct', insert:'struct ${1:Name} {\n    ${2};\n};' },
      { label:'if', detail:'if/else', insert:'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}' },
      { label:'sw', detail:'switch', insert:'switch (${1:expr}) {\n    case ${2:val}:\n        ${3}\n        break;\n    default:\n        ${4}\n}' },
      { label:'fun', detail:'function', insert:'${1:void} ${2:name}(${3}) {\n    ${4}\n}' },
    ],
    cpp: [], // will copy from c below

    // ---- Go --------------------------------------------------
    go: [
      { label:'pkg', detail:'package main', insert:'package main\n\nimport (\n    "fmt"\n)\n\nfunc main() {\n    ${1}\n}' },
      { label:'fn', detail:'func', insert:'func ${1:name}(${2}) ${3:error} {\n    ${4}\n}' },
      { label:'fmt', detail:'fmt.Println', insert:'fmt.Println(${1})' },
      { label:'err', detail:'error check', insert:'if err != nil {\n    return ${1}err\n}' },
      { label:'for', detail:'for loop', insert:'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n    ${3}\n}' },
      { label:'range', detail:'for range', insert:'for ${1:i}, ${2:v} := range ${3:slice} {\n    ${4}\n}' },
      { label:'goroutine', detail:'go func', insert:'go func() {\n    ${1}\n}()' },
      { label:'chan', detail:'channel', insert:'${1:ch} := make(chan ${2:int})' },
      { label:'struct', detail:'struct', insert:'type ${1:Name} struct {\n    ${2:Field} ${3:string}\n}' },
      { label:'iface', detail:'interface', insert:'type ${1:Name} interface {\n    ${2:Method}() ${3:error}\n}' },
    ],

    // ---- Rust ------------------------------------------------
    rust: [
      { label:'fn', detail:'function', insert:'fn ${1:name}(${2}) -> ${3:()} {\n    ${4}\n}' },
      { label:'main', detail:'fn main', insert:'fn main() {\n    ${1}\n}' },
      { label:'println', detail:'println!', insert:'println!("${1}", ${2});' },
      { label:'let', detail:'let binding', insert:'let ${1:mut }${2:name}: ${3:i32} = ${4};' },
      { label:'struct', detail:'struct', insert:'struct ${1:Name} {\n    ${2:field}: ${3:Type},\n}' },
      { label:'impl', detail:'impl block', insert:'impl ${1:Name} {\n    fn ${2:new}() -> Self {\n        ${3}\n    }\n}' },
      { label:'enum', detail:'enum', insert:'enum ${1:Name} {\n    ${2:Variant1},\n    ${3:Variant2},\n}' },
      { label:'match', detail:'match', insert:'match ${1:expr} {\n    ${2:pattern} => ${3:result},\n    _ => ${4},\n}' },
      { label:'for', detail:'for loop', insert:'for ${1:item} in ${2:iter} {\n    ${3}\n}' },
      { label:'if', detail:'if let', insert:'if let Some(${1:val}) = ${2:opt} {\n    ${3}\n}' },
      { label:'res', detail:'Result', insert:'Result<${1:T}, ${2:E}>' },
      { label:'opt', detail:'Option', insert:'Option<${1:T}>' },
      { label:'vec', detail:'vec!', insert:'let ${1:v} = vec![${2}];' },
      { label:'trt', detail:'trait', insert:'trait ${1:Name} {\n    fn ${2:method}(&self);\n}' },
    ],

    // ---- PHP -------------------------------------------------
    php: [
      { label:'php', detail:'<?php', insert:'<?php\n${1}' },
      { label:'echo', detail:'echo', insert:'echo ${1};' },
      { label:'fn', detail:'function', insert:'function ${1:name}(${2}) {\n    ${3}\n}' },
      { label:'class', detail:'class', insert:'class ${1:Name} {\n    public function __construct(${2}) {\n        ${3}\n    }\n}' },
      { label:'if', detail:'if/else', insert:'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}' },
      { label:'for', detail:'foreach', insert:'foreach (${1:\\$array} as ${2:\\$key} => ${3:\\$value}) {\n    ${4}\n}' },
      { label:'arr', detail:'array', insert:'\\$${1:arr} = [${2}];' },
      { label:'req', detail:'require_once', insert:"require_once '${1}';'" },
    ],

    // ---- Ruby ------------------------------------------------
    ruby: [
      { label:'def', detail:'def method', insert:'def ${1:name}\n  ${2}\nend' },
      { label:'class', detail:'class', insert:'class ${1:Name}\n  def initialize(${2})\n    ${3}\n  end\nend' },
      { label:'do', detail:'do/end block', insert:'do |${1:item}|\n  ${2}\nend' },
      { label:'each', detail:'.each', insert:'.each do |${1:item}|\n  ${2}\nend' },
      { label:'map', detail:'.map', insert:'.map { |${1:item}| ${2} }' },
      { label:'if', detail:'if/else', insert:'if ${1:condition}\n  ${2}\nelse\n  ${3}\nend' },
      { label:'puts', detail:'puts', insert:'puts ${1}' },
    ],

    // ---- Swift -----------------------------------------------
    swift: [
      { label:'fn', detail:'func', insert:'func ${1:name}(${2}) -> ${3:Void} {\n    ${4}\n}' },
      { label:'struct', detail:'struct', insert:'struct ${1:Name} {\n    var ${2:prop}: ${3:String}\n}' },
      { label:'class', detail:'class', insert:'class ${1:Name} {\n    init(${2}) {\n        ${3}\n    }\n}' },
      { label:'pr', detail:'print()', insert:'print(${1})' },
      { label:'for', detail:'for-in', insert:'for ${1:item} in ${2:collection} {\n    ${3}\n}' },
      { label:'if', detail:'if let', insert:'if let ${1:val} = ${2:opt} {\n    ${3}\n}' },
      { label:'guard', detail:'guard let', insert:'guard let ${1:val} = ${2:opt} else {\n    ${3:return}\n}' },
      { label:'closure', detail:'closure', insert:'{ (${1:param}: ${2:Type}) -> ${3:Void} in\n    ${4}\n}' },
      { label:'enum', detail:'enum', insert:'enum ${1:Name} {\n    case ${2:value1}\n    case ${3:value2}\n}' },
    ],

    // ---- Kotlin ----------------------------------------------
    kotlin: [
      { label:'fn', detail:'fun', insert:'fun ${1:name}(${2}): ${3:Unit} {\n    ${4}\n}' },
      { label:'main', detail:'main function', insert:'fun main() {\n    ${1}\n}' },
      { label:'pr', detail:'println', insert:'println(${1})' },
      { label:'class', detail:'data class', insert:'data class ${1:Name}(\n    val ${2:prop}: ${3:String}\n)' },
      { label:'for', detail:'for loop', insert:'for (${1:item} in ${2:collection}) {\n    ${3}\n}' },
      { label:'when', detail:'when expression', insert:'when (${1:expr}) {\n    ${2} -> ${3}\n    else -> ${4}\n}' },
      { label:'lambda', detail:'lambda', insert:'{ ${1:it} -> ${2} }' },
      { label:'obj', detail:'object', insert:'object ${1:Name} {\n    ${2}\n}' },
    ],

    // ---- SQL -------------------------------------------------
    sql: [
      { label:'sel', detail:'SELECT', insert:'SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};' },
      { label:'ins', detail:'INSERT', insert:"INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});" },
      { label:'upd', detail:'UPDATE', insert:'UPDATE ${1:table}\nSET ${2:col} = ${3:val}\nWHERE ${4:condition};' },
      { label:'del', detail:'DELETE', insert:'DELETE FROM ${1:table}\nWHERE ${2:condition};' },
      { label:'create', detail:'CREATE TABLE', insert:'CREATE TABLE ${1:name} (\n    ${2:id} INTEGER PRIMARY KEY,\n    ${3:col} ${4:TEXT}\n);' },
      { label:'join', detail:'INNER JOIN', insert:'INNER JOIN ${1:table} ON ${2:condition}' },
      { label:'grp', detail:'GROUP BY', insert:'GROUP BY ${1:col}\nHAVING ${2:condition}' },
      { label:'idx', detail:'CREATE INDEX', insert:'CREATE INDEX ${1:idx_name} ON ${2:table}(${3:col});' },
    ],

    // ---- JSON ------------------------------------------------
    json: [
      { label:'obj', detail:'object', insert:'{\n  "${1:key}": "${2:value}"\n}' },
      { label:'arr', detail:'array', insert:'[\n  ${1}\n]' },
      { label:'pkg', detail:'package.json', insert:'{\n  "name": "${1:project}",\n  "version": "${2:1.0.0}",\n  "scripts": {\n    "start": "${3:node index.js}"\n  },\n  "dependencies": {}\n}' },
    ],

    // ---- Markdown --------------------------------------------
    markdown: [
      { label:'h1', detail:'# Heading 1', insert:'# ${1:Heading}' },
      { label:'h2', detail:'## Heading 2', insert:'## ${1:Heading}' },
      { label:'h3', detail:'### Heading 3', insert:'### ${1:Heading}' },
      { label:'b', detail:'**bold**', insert:'**${1:text}**' },
      { label:'i', detail:'*italic*', insert:'*${1:text}*' },
      { label:'code', detail:'`code`', insert:'`${1:code}`' },
      { label:'block', detail:'code block', insert:'```${1:lang}\n${2}\n```' },
      { label:'link', detail:'[link](url)', insert:'[${1:text}](${2:url})' },
      { label:'img', detail:'![image](url)', insert:'![${1:alt}](${2:url})' },
      { label:'table', detail:'table', insert:'| ${1:Col 1} | ${2:Col 2} |\n| --- | --- |\n| ${3:val} | ${4:val} |' },
      { label:'todo', detail:'task list', insert:'- [ ] ${1:task}' },
      { label:'q', detail:'blockquote', insert:'> ${1}' },
      { label:'hr', detail:'horizontal rule', insert:'---' },
    ],

    // ---- YAML -----------------------------------------------
    yaml: [
      { label:'map', detail:'mapping', insert:'${1:key}:\n  ${2:nested}: ${3:value}' },
      { label:'list', detail:'sequence', insert:'${1:key}:\n  - ${2:item}' },
      { label:'anchor', detail:'anchor/alias', insert:'${1:base}: &${2:anchor}\n  ${3:key}: ${4:value}\n${5:child}:\n  <<: *${2:anchor}' },
    ],

    // ---- Shell / Bash ----------------------------------------
    shell: [
      // ── Boilerplate ──────────────────────────────────────────
      { label:'she',     detail:'#!/bin/bash shebang',         insert:'#!/bin/bash\n${1}' },
      { label:'shzsh',   detail:'#!/bin/zsh shebang',          insert:'#!/bin/zsh\n${1}' },
      { label:'shsh',    detail:'#!/bin/sh shebang',           insert:'#!/bin/sh\n${1}' },
      { label:'shebang', detail:'Full script header',          insert:'#!/bin/bash\n# ==============================================\n# Script : ${1:script_name}.sh\n# Author : ${2:Nandan Das}\n# Date   : $(date +%Y-%m-%d)\n# Desc   : ${3:Description}\n# ==============================================\nset -euo pipefail\n\n${4}' },
      { label:'strict',  detail:'set -euo pipefail',           insert:'set -euo pipefail\nIFS=\\$\'\\n\\t\'' },

      // ── Variables ────────────────────────────────────────────
      { label:'var',    detail:'variable declaration',         insert:'${1:VAR}="${2:value}"' },
      { label:'env',    detail:'export env var',               insert:'export ${1:VAR}="${2:value}"' },
      { label:'def',    detail:'default value',                insert:'${1:VAR}="${${1:VAR}:-${2:default}}"' },
      { label:'arr',    detail:'array declaration',            insert:'${1:arr}=(${2:"item1" "item2" "item3"})' },
      { label:'arridx', detail:'array index access',           insert:'echo "${${1:arr}[${2:0}]}"' },
      { label:'arrall', detail:'all array elements',           insert:'echo "${${1:arr}[@]}"' },
      { label:'arrlen', detail:'array length',                 insert:'echo "${#${1:arr}[@]}"' },
      { label:'map',    detail:'associative array (map)',       insert:'declare -A ${1:map}\n${1:map}["${2:key}"]="${3:value}"' },

      // ── Control flow ─────────────────────────────────────────
      { label:'if',     detail:'if statement',                 insert:'if [ ${1:condition} ]; then\n  ${2}\nfi' },
      { label:'ife',    detail:'if/else',                      insert:'if [ ${1:condition} ]; then\n  ${2}\nelse\n  ${3}\nfi' },
      { label:'ifei',   detail:'if/elif/else',                 insert:'if [ ${1:condition} ]; then\n  ${2}\nelif [ ${3:condition2} ]; then\n  ${4}\nelse\n  ${5}\nfi' },
      { label:'ifd',    detail:'if directory exists',          insert:'if [ -d "${1:dir}" ]; then\n  ${2}\nfi' },
      { label:'iff',    detail:'if file exists',               insert:'if [ -f "${1:file}" ]; then\n  ${2}\nfi' },
      { label:'ifn',    detail:'if not empty',                 insert:'if [ -n "${1:var}" ]; then\n  ${2}\nfi' },
      { label:'ifz',    detail:'if empty/zero',                insert:'if [ -z "${1:var}" ]; then\n  ${2}\nfi' },
      { label:'ifeq',   detail:'if equal',                     insert:'if [ "${1:a}" = "${2:b}" ]; then\n  ${3}\nfi' },
      { label:'ifne',   detail:'if not equal',                 insert:'if [ "${1:a}" != "${2:b}" ]; then\n  ${3}\nfi' },
      { label:'ifnum',  detail:'if number compare',            insert:'if [ ${1:a} -${2:eq} ${3:b} ]; then\n  ${4}\nfi' },
      { label:'case',   detail:'case statement',               insert:'case "${1:\\$var}" in\n  ${2:pattern1})\n    ${3}\n    ;;\n  ${4:pattern2})\n    ${5}\n    ;;\n  *)\n    ${6:default}\n    ;;\nesac' },

      // ── Loops ────────────────────────────────────────────────
      { label:'for',    detail:'for loop over list',           insert:'for ${1:item} in ${2:list}; do\n  echo "${${1:item}}"\n  ${3}\ndone' },
      { label:'fori',   detail:'C-style for loop',             insert:'for (( ${1:i}=0; ${1:i}<${2:10}; ${1:i}++ )); do\n  ${3}\ndone' },
      { label:'forr',   detail:'for loop with range',          insert:'for ${1:i} in $(seq ${2:1} ${3:10}); do\n  echo "${1:i}=$${1:i}"\n  ${4}\ndone' },
      { label:'forf',   detail:'for each file in dir',         insert:'for ${1:file} in ${2:.}/*; do\n  echo "File: $${1:file}"\n  ${3}\ndone' },
      { label:'forline',detail:'for each line in file',        insert:'while IFS= read -r ${1:line}; do\n  echo "$${1:line}"\n  ${2}\ndone < "${3:file.txt}"' },
      { label:'while',  detail:'while loop',                   insert:'while [ ${1:condition} ]; do\n  ${2}\ndone' },
      { label:'until',  detail:'until loop',                   insert:'until [ ${1:condition} ]; do\n  ${2}\ndone' },
      { label:'inf',    detail:'infinite loop',                insert:'while true; do\n  ${1}\n  sleep ${2:1}\ndone' },

      // ── Functions ────────────────────────────────────────────
      { label:'fn',     detail:'function declaration',         insert:'${1:function_name}() {\n  local ${2:arg}="$1"\n  ${3}\n}' },
      { label:'fnr',    detail:'function with return',         insert:'${1:name}() {\n  local result="${2}"\n  echo "$result"\n  return ${3:0}\n}' },
      { label:'fnlog',  detail:'logger function',              insert:'log() {\n  echo "[$(date +%H:%M:%S)] $*"\n}\n\nlog "${1:message}"' },
      { label:'fnerr',  detail:'error handler function',       insert:'err() {\n  echo "[ERROR] $*" >&2\n  exit 1\n}\n\n${1:command} || err "${2:Something failed}"' },
      { label:'fnusage',detail:'usage/help function',          insert:'usage() {\n  echo "Usage: $0 [OPTIONS]"\n  echo ""\n  echo "Options:"\n  echo "  -h    Show this help"\n  echo "  -v    Verbose mode"\n  exit 0\n}\n\n[ "$1" = "-h" ] && usage' },
      { label:'fnmain', detail:'main function pattern',        insert:'main() {\n  ${1}\n}\n\nmain "$@"' },

      // ── I/O ──────────────────────────────────────────────────
      { label:'ec',     detail:'echo string',                  insert:'echo "${1:message}"' },
      { label:'ecc',    detail:'echo with color',              insert:'echo -e "\\033[${1:32}m${2:message}\\033[0m"' },
      { label:'ecr',    detail:'echo red error',               insert:'echo -e "\\033[31m[ERROR]\\033[0m ${1:message}" >&2' },
      { label:'ecg',    detail:'echo green success',           insert:'echo -e "\\033[32m[OK]\\033[0m ${1:message}"' },
      { label:'ecy',    detail:'echo yellow warning',          insert:'echo -e "\\033[33m[WARN]\\033[0m ${1:message}"' },
      { label:'read',   detail:'read user input',              insert:'read -p "${1:Enter value: }" ${2:var}' },
      { label:'reads',  detail:'read secret/password',         insert:'read -s -p "${1:Password: }" ${2:pass}' },
      { label:'readyn', detail:'yes/no prompt',                insert:'read -p "${1:Continue?} [y/N] " ans\nif [[ "$ans" =~ ^[Yy]$ ]]; then\n  ${2}\nfi' },
      { label:'printf', detail:'printf formatted',             insert:'printf "%-${1:20}s %s\\n" "${2:label}" "${3:value}"' },

      // ── File & Directory ops ─────────────────────────────────
      { label:'mkd',    detail:'mkdir -p',                     insert:'mkdir -p "${1:path}"' },
      { label:'cp',     detail:'copy file/dir',                insert:'cp -r "${1:src}" "${2:dest}"' },
      { label:'mv',     detail:'move/rename',                  insert:'mv "${1:src}" "${2:dest}"' },
      { label:'rm',     detail:'remove safely',                insert:'rm -rf "${1:path}"' },
      { label:'find',   detail:'find files',                   insert:'find "${1:.}" -name "${2:*.txt}" -type f' },
      { label:'grep',   detail:'grep search',                  insert:'grep -r "${1:pattern}" "${2:.}"' },
      { label:'sed',    detail:'sed replace',                  insert:'sed -i "s/${1:old}/${2:new}/g" "${3:file}"' },
      { label:'awk',    detail:'awk column print',             insert:"awk '{print \\$${1:1}}' ${2:file}" },
      { label:'sort',   detail:'sort unique',                  insert:'sort -u "${1:file}"' },
      { label:'wc',     detail:'word/line count',              insert:'wc -l "${1:file}"' },
      { label:'head',   detail:'head N lines',                 insert:'head -n ${1:10} "${2:file}"' },
      { label:'tail',   detail:'tail N lines / follow',        insert:'tail -n ${1:10} "${2:file}"' },
      { label:'tailf',  detail:'tail -f (follow log)',         insert:'tail -f "${1:file.log}"' },
      { label:'cat',    detail:'cat file',                     insert:'cat "${1:file}"' },
      { label:'tee',    detail:'tee to file and stdout',       insert:'${1:command} | tee "${2:output.log}"' },
      { label:'chmod',  detail:'chmod',                        insert:'chmod ${1:755} "${2:file}"' },
      { label:'chown',  detail:'chown',                        insert:'chown ${1:user}:${2:group} "${3:file}"' },
      { label:'ln',     detail:'symlink',                      insert:'ln -s "${1:target}" "${2:link}"' },
      { label:'zip',    detail:'zip directory',                insert:'zip -r "${1:archive.zip}" "${2:folder/}"' },
      { label:'unzip',  detail:'unzip archive',                insert:'unzip "${1:archive.zip}" -d "${2:.}"' },
      { label:'tar',    detail:'tar compress',                 insert:'tar -czf "${1:archive.tar.gz}" "${2:folder/}"' },
      { label:'tarx',   detail:'tar extract',                  insert:'tar -xzf "${1:archive.tar.gz}" -C "${2:.}"' },

      // ── Strings ──────────────────────────────────────────────
      { label:'lower',  detail:'to lowercase',                 insert:'echo "${${1:var},,}"' },
      { label:'upper',  detail:'to uppercase',                 insert:'echo "${${1:var}^^}"' },
      { label:'len',    detail:'string length',                insert:'echo "${#${1:var}}"' },
      { label:'sub',    detail:'substring',                    insert:'echo "${${1:var}:${2:0}:${3:5}}"' },
      { label:'rep',    detail:'string replace',               insert:'echo "${${1:var}/${2:old}/${3:new}}"' },
      { label:'trim',   detail:'trim whitespace',              insert:'${1:var}="$(echo -e "${${1:var}}" | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//")"' },
      { label:'split',  detail:'split string into array',      insert:'IFS="${1:,}" read -ra ${2:arr} <<< "${${3:var}}"' },

      // ── Process & System ─────────────────────────────────────
      { label:'pid',    detail:'get PID',                      insert:'echo "PID: $$"' },
      { label:'bg',     detail:'run in background',            insert:'${1:command} &\nBG_PID=$!\necho "Started PID $BG_PID"' },
      { label:'wait',   detail:'wait for background job',      insert:'wait $BG_PID\necho "Job done, exit: $?"' },
      { label:'trap',   detail:'trap exit signal',             insert:'cleanup() {\n  echo "Cleaning up..."\n  ${1}\n}\ntrap cleanup EXIT INT TERM' },
      { label:'kill',   detail:'kill process',                 insert:'kill -${1:TERM} ${2:\\$PID}' },
      { label:'ps',     detail:'find process',                 insert:'ps aux | grep "${1:process}"' },
      { label:'cpu',    detail:'CPU usage',                    insert:'top -bn1 | grep "Cpu(s)" | awk \'{print $2}\'' },
      { label:'mem',    detail:'memory usage',                 insert:'free -h | awk \'/^Mem:/ {print $3 "/" $2}\'' },
      { label:'disk',   detail:'disk usage',                   insert:'df -h "${1:/}" | awk \'NR==2 {print $5}\'' },
      { label:'os',     detail:'detect OS',                    insert:'OS="$(uname -s)"\ncase "$OS" in\n  Linux*)   echo "Linux" ;;\n  Darwin*)  echo "macOS" ;;\n  CYGWIN*)  echo "Windows" ;;\n  *)        echo "Unknown: $OS" ;;\nesac' },

      // ── Networking ───────────────────────────────────────────
      { label:'curl',   detail:'curl GET request',             insert:'curl -s "${1:https://api.example.com}"' },
      { label:'curlj',  detail:'curl JSON POST',               insert:'curl -s -X POST "${1:url}" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"${2:key}": "${3:value}"}\'' },
      { label:'curlh',  detail:'curl with headers',            insert:'curl -s -H "Authorization: Bearer ${1:token}" "${2:url}"' },
      { label:'wget',   detail:'wget download',                insert:'wget -q -O "${1:output}" "${2:url}"' },
      { label:'port',   detail:'check if port open',           insert:'if nc -z "${1:localhost}" ${2:3000} 2>/dev/null; then\n  echo "Port ${2:3000} is open"\nelse\n  echo "Port ${2:3000} is closed"\nfi' },
      { label:'ip',     detail:'get public IP',                insert:'curl -s https://ifconfig.me' },
      { label:'ping',   detail:'ping host',                    insert:'ping -c ${1:4} "${2:google.com}"' },

      // ── Git shortcuts ────────────────────────────────────────
      { label:'ginit',  detail:'git init + first commit',      insert:'git init\ngit add .\ngit commit -m "${1:Initial commit}"' },
      { label:'gst',    detail:'git status',                   insert:'git status' },
      { label:'gadd',   detail:'git add all + commit',         insert:'git add .\ngit commit -m "${1:commit message}"' },
      { label:'gpush',  detail:'git push',                     insert:'git push ${1:origin} ${2:main}' },
      { label:'gpull',  detail:'git pull',                     insert:'git pull ${1:origin} ${2:main}' },
      { label:'gbranch',detail:'git new branch',               insert:'git checkout -b "${1:branch-name}"' },
      { label:'glog',   detail:'git log pretty',               insert:'git log --oneline --graph --decorate' },
      { label:'gclone', detail:'git clone',                    insert:'git clone "${1:https://github.com/user/repo.git}"' },

      // ── npm / Node ───────────────────────────────────────────
      { label:'npmi',   detail:'npm install',                  insert:'npm install ${1:package}' },
      { label:'npmig',  detail:'npm install global',           insert:'npm install -g ${1:package}' },
      { label:'npms',   detail:'npm start',                    insert:'npm start' },
      { label:'npmr',   detail:'npm run',                      insert:'npm run ${1:script}' },
      { label:'npminit',detail:'npm init',                     insert:'npm init -y' },

      // ── Python shortcuts ─────────────────────────────────────
      { label:'pyrun',  detail:'run python file',              insert:'python3 "${1:script.py}"' },
      { label:'pyenv',  detail:'create virtualenv',            insert:'python3 -m venv ${1:venv}\nsource ${1:venv}/bin/activate' },
      { label:'pipi',   detail:'pip install',                  insert:'pip install ${1:package}' },
      { label:'pipf',   detail:'pip freeze to requirements',   insert:'pip freeze > requirements.txt' },
      { label:'pipr',   detail:'pip install requirements',     insert:'pip install -r requirements.txt' },

      // ── Error handling ───────────────────────────────────────
      { label:'onerr',  detail:'exit on error with message',   insert:'${1:command} || { echo "Error: ${2:failed}"; exit 1; }' },
      { label:'check',  detail:'check command exists',         insert:'command -v ${1:git} >/dev/null 2>&1 || { echo "${1:git} not found"; exit 1; }' },
      { label:'tryc',   detail:'try/catch pattern',            insert:'if ! ${1:command}; then\n  echo "Failed: ${1:command}" >&2\n  exit 1\nfi' },
      { label:'retry',  detail:'retry command N times',        insert:'for i in $(seq 1 ${1:3}); do\n  ${2:command} && break\n  echo "Retry $i/${1:3}..."\n  sleep ${3:2}\ndone' },

      // ── Logging / debug ──────────────────────────────────────
      { label:'logfile',detail:'log to file',                  insert:'LOG="${1:app.log}"\nexec >> "$LOG" 2>&1\necho "=== Started $(date) ==="' },
      { label:'debug',  detail:'debug mode toggle',            insert:'DEBUG=${DEBUG:-0}\n[ "$DEBUG" = "1" ] && set -x' },
      { label:'time',   detail:'time a command',               insert:'time ${1:command}' },
      { label:'bench',  detail:'simple benchmark',             insert:'START=$(date +%s%N)\n${1:command}\nEND=$(date +%s%N)\necho "Took: $(( (END - START) / 1000000 ))ms"' },

      // ── Cron / scheduling ────────────────────────────────────
      { label:'cron',   detail:'crontab entry',                insert:'# ${1:* * * * *}  ${2:command}\n# m h dom mon dow\n${3:0 * * * *}  ${4:/path/to/script.sh}' },
      { label:'crondaily',detail:'daily cron',                 insert:'0 0 * * * ${1:/path/to/script.sh} >> ${2:/var/log/script.log} 2>&1' },

      // ── Complete script templates ─────────────────────────────
      { label:'script', detail:'full bash script template',    insert:'#!/bin/bash\n# ==============================================\n# ${1:Script Name}\n# Author: Nandan Das\n# ==============================================\nset -euo pipefail\n\n# Colors\nRED="\\033[0;31m" GREEN="\\033[0;32m" YELLOW="\\033[1;33m" NC="\\033[0m"\n\nlog()  { echo -e "${GREEN}[OK]${NC} $*"; }\nwarn() { echo -e "${YELLOW}[WARN]${NC} $*"; }\nerr()  { echo -e "${RED}[ERR]${NC} $*" >&2; exit 1; }\n\nmain() {\n  log "Starting ${1:Script Name}..."\n  ${2}\n  log "Done!"\n}\n\nmain "$@"' },
      { label:'backup', detail:'backup script template',       insert:'#!/bin/bash\nSRC="${1:/data}"\nDEST="${2:/backup}"\nDATE=$(date +%Y%m%d_%H%M%S)\nTARGET="$DEST/backup_$DATE.tar.gz"\nmkdir -p "$DEST"\ntar -czf "$TARGET" "$SRC"\necho "Backup saved: $TARGET"' },
      { label:'deploy', detail:'simple deploy script',         insert:'#!/bin/bash\nset -e\necho "Deploying..."\ngit pull origin main\nnpm install --production\nnpm run build\necho "Deploy complete!"' },
      { label:'monitor',detail:'process monitor loop',         insert:'#!/bin/bash\nPROCESS="${1:node}"\nwhile true; do\n  if ! pgrep -x "$PROCESS" > /dev/null; then\n    echo "[$(date)] $PROCESS not running — restarting..."\n    ${2:npm start} &\n  fi\n  sleep ${3:30}\ndone' },
    ],

    // ---- Dockerfile ------------------------------------------
    dockerfile: [
      { label:'from', detail:'FROM', insert:'FROM ${1:node}:${2:18-alpine}' },
      { label:'run', detail:'RUN', insert:'RUN ${1}' },
      { label:'cmd', detail:'CMD', insert:'CMD ["${1:node}", "${2:index.js}"]' },
      { label:'copy', detail:'COPY', insert:'COPY ${1:.} ${2:/app}' },
      { label:'work', detail:'WORKDIR', insert:'WORKDIR ${1:/app}' },
      { label:'env', detail:'ENV', insert:'ENV ${1:NODE_ENV}=${2:production}' },
      { label:'expose', detail:'EXPOSE', insert:'EXPOSE ${1:3000}' },
      { label:'vol', detail:'VOLUME', insert:'VOLUME ["${1:/data}"]' },
      { label:'node', detail:'Node.js Dockerfile', insert:'FROM node:${1:18-alpine}\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --production\nCOPY . .\nEXPOSE ${2:3000}\nCMD ["node", "${3:index.js}"]' },
    ],
  },

  // ---- Register with Monaco ----------------------------------
  register() {
    // Copy C snippets to C++
    this._snippets.cpp = [...(this._snippets.c || [])];
    // SCSS/LESS share CSS snippets
    this._snippets.scss = [...(this._snippets.css || [])];
    this._snippets.less = [...(this._snippets.css || [])];

    const langMap = {
      html:       ['html'],
      css:        ['css','scss','less'],
      javascript: ['javascript'],
      typescript: ['typescript'],
      python:     ['python'],
      java:       ['java'],
      c:          ['c'],
      cpp:        ['cpp'],
      go:         ['go'],
      rust:       ['rust'],
      php:        ['php'],
      ruby:       ['ruby'],
      swift:      ['swift'],
      kotlin:     ['kotlin'],
      sql:        ['sql','mysql','pgsql'],
      json:       ['json'],
      markdown:   ['markdown'],
      yaml:       ['yaml'],
      shell:      ['shell','bash','sh'],
      dockerfile: ['dockerfile'],
    };

    // Also register a universal provider for any language
    const allSnippets = Object.values(this._snippets).flat();

    Object.entries(langMap).forEach(([key, langs]) => {
      const snippets = this._snippets[key] || [];
      langs.forEach(lang => {
        monaco.languages.registerCompletionItemProvider(lang, {
          triggerCharacters: [],
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber:   position.lineNumber,
              startColumn:     word.startColumn,
              endColumn:       word.endColumn,
            };
            return {
              suggestions: snippets.map(s => ({
                label:           s.label,
                kind:            monaco.languages.CompletionItemKind.Snippet,
                detail:          s.detail,
                documentation:   s.detail,
                insertText:      s.insert,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              }))
            };
          }
        });
      });
    });

    // Universal fallback — plaintext + any unregistered language
    monaco.languages.registerCompletionItemProvider('plaintext', {
      provideCompletionItems: () => ({ suggestions: [] })
    });
  }
};
