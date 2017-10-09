import io from 'socket.io-client'
import feathers from 'feathers/client'
import socketio from 'feathers-socketio/client'

const socket = io('http://localhost:3030')
const client = feathers()
  .configure(socketio(socket))

const projects = client.service('/projects')

// Fetch entries
projects.find().then(results => {
  console.log('Projects:', results)
})

// Listen for events
projects.on('created', datum => {
  console.log('Project added:', datum)
})

// Create entries
const button = document.querySelector('#new-project')
const name = document.querySelector('#name')
button.addEventListener('click', () => {
  projects.create({
    path: `./${name.value}`,
  })
})

// If a real file is dirty (source files
// newer than it), you can hit a button
// to `touch` it
//
// Having dirty source files
// also makes a file dirty

const formulas = {
  'scenePage': {
    filename: '{i}.jpg',
    input: null
  },
  'lineRectangle': {
    filename: 'rects/{i}.json',
    input: {'scenePage': 'single'}
  },
  'lineRecording': {
    filename: 'lines/{i}.wav',
    input: {
      'scenePage': 'single',
      'lineRectangle': 'single'
    }
  },
  'sceneAudio': {
    filename: '{i}.wav',
    input: {'lineRecording': 'multiple'}
  },
  'sceneFLA': {
    filename: '{i}.fla',
    input: {'sceneAudio': 'single'}
  },
  'sceneRendered': {
    filename: '{i}.avi',
    input: {'sceneFLA': 'single'}
  },
  'movie': {
    filename: '{folderName}.mp4',
    input: {'sceneRendered': 'multiple'}
  }
}
/*
 *
   * pageStoryboard - JPG, branch by file list
     * lineStoryboard - JSON, branch by file list
     * lineAudio - WAV, 1:1
   * pageAudio - WAV, collapse
   * pageFLA - FLA, 1:1
   * pageRendered - AVI, 1:1
 * movie - MP4, collapse
 *
 *
 * pagesStoryboard = getFileList(folder)
 * pagesLinesStoryboard = pagesStoryboard
 *   .map(splitPageIntoLines)
 * pagesLinesAudio = pagesLinesStoryboard.map(
 *   linesStoryboard => linesStoryboard
 *     .map(voiceLineStoryboard)
 * )
 * pagesAudio = joinLinesAudio(pagesLinesAudio)
 * pagesFLA = pagesAudio.map(animateAudio)
 * pagesRendered = pagesFLA.map(renderFLA)
 * movie = joinPagesRendered(pagesRendered)
 *
 * result = performStep(steps, 'final step')
 * function performStep(steps, stepID) {
 *   const {action, srcStep} = steps[stepID]
 *   return action(performStep(steps, srcStep))
 * }
 *
 * The way a step uses data can't just be
 * the behavior of the function because
 * you need that info for the dirtiness graph
 *
 * FILE EXTENSIONS MEAN NOTHING TO THE MATCHER
 *
 * Filenames with spaces are ignored
 * (regarding many-from-one branchings)
 * SHOW A "(+20 ineligible files)"
 * NEED explanation of what a filename could
 * be to be considered eligible
 *
 * It's ALWAYS in sorted order
 * USE THE `node-natural-sort` PACKAGE
 *
 * * * * * * * * * * * * * * * * * * * * * * *
 *
 * function findSources(filename, step, branchesLeft = 0) {
 *   const newBL = branchesLeft + {
 *     'oneFromMany: 1, 'manyFromOne': -1
 *   }[step.mapping] || 0
 *
 *   // Degenerate case
 *   if (newBL <= 0) {
 *     return [step.filePattern.undo(filename)]
 *   }
 *
 *   const sources = findSources(???, step.prevStep, newBL)
 *   return (
 *     step.mapping === 'oneFromMany'
 *     ? sources.slice(0, 1)
 *     : sources
 *   ).map(source => step.filePattern.transform(source)
 *
 *
 *
 *
 *
 * ` if (step.mapping === 'oneFromOne') {
 *     return [step.filePattern.undo(filename)]
 *   } else if (step.mapping === 'manyFromOne') {
 *     return findSources(
 *       step.filePattern.undo(filename),
 *       step.prevStep,
 *       branchesLeft - 1
 *     )
 *   } else if (step.mapping === 'oneFromMany') {
 *   }
 * }
 *
 * function makeThing(filename, step) {
 *   // Degenerate case
 *   if (fileExists(filename)) return read(filename)
 *
 *   const sourceNames = findSources(filename, step)
 *   sourceNames = step.filePattern.undo(filename)
 *   const sourceFiles = sourceNames.map(name =>
 *     makeThing(name, step.prevStep))
 *
 *   return step.action(sources)
 * }
 *
 */
const recipes = {
  'page-storyboard': {
    filePattern: (srcName, srcI) =>
      ['.jpg'],
    predecessor: null,
    mapping: 'manyFromOne'
  },
  'line-storyboard': {
    filePattern: srcName => `rects/${srcName}`,
    predecessor: 'page-storyboard',
    mapping: 'manyFromOne'
  }
}

/*
 *  _                                  _
 * | |_ _ __ _   _    __ _  __ _  __ _(_)_ __
 * | __| '__| | | |  / _` |/ _` |/ _` | | '_ \
 * | |_| |  | |_| | | (_| | (_| | (_| | | | | |
 *  \__|_|   \__, |  \__,_|\__, |\__,_|_|_| |_|
 *           |___/         |___/
 * This is just from above:
   * pageStoryboard - JPG, branch by file list
     * lineStoryboard - JSON, branch by file list
     * lineAudio - WAV, 1:1
   * pageAudio - WAV, collapse
   * pageFLA - FLA, 1:1
   * pageRendered - AVI, 1:1
 * movie - MP4, collapse
 *
 * Now this time, why don't we go from the
 * bottom up, rather than the top down?
 * So, let's start with the storyboard pages.
 *
 */

// Add options:
//
// [ ] Don't do any file generation
//     (This means branching can't be)
//     (affected by file content     )
//
// [ ] Callback function that gets
//     notified of each file list,
//     like to build up a total tree
const result = recipes.reduce((files, recipe) => {

  // Deal with mappings that aren't 1:1

  if (recipe.mapping === 'oneFromMany') {
    // Collapse groups, grouping by dest filename

    const f = files.entries()
    const files = f.reduce((newFiles, entry) => {
      const [path, content] = entry
      const newPath = recipe.nameTransform(path, content)

      if (!newFiles.has(newPath)) {
        newFiles.set(newPath, {
          date: 0, source: [], data: []
        })
      }
      const newContent = newFiles.get(newPath)
      newContent.data.push(entry)
      newContent.source.push(path)
      newContent.date = Math.max(
        newContent.date, content.date
      )
      return newFiles
    }, new Map())

  } else if (recipe.mapping === 'manyFromOne') {
    // Split each file into files, content cloned

    const f = files.entries()
    files = new Map([...entries.map(entry => {
      const [path, content] = entry
      const newPaths = [
        ...recipe.expandFind().map(instance =>
          recipe.nameTransform(path, content, instance)
        ),
        ...recipe.expandDefault().map(instance =>
          recipe.nameTransform(path, content, instance)
        ),
        // Not needed for bfdi
      ]
      return newPaths.map(newPath => {
        return [newPath, {source: path, ...content}]
      })
    })])

  } else {
    files = new Map(files.entries().map(entry => {
      const [path, content] = entry
      const newPath = recipe.nameTransform(path, content)
      content.source = path
      return [newPath, content]
    }))
  }

  // Now do a map (which is 1:1)
  return new Map(files.entries().map(entry => {
    const [path, content] = entry
    const shouldOverride = fileExists(path)
    const newData = shouldOverride
      ? readFile(newPath)
      : recipe.transform(content.data)
    const newContent = {
      data: newData
      dirty: shouldOverride &&
        content.date > fileDate(newPath)
    }
    return [path, newContent]
  })),

}, new Map(['~/my/project/root', null]))

const recipes = {
  'teams': {
    mapping: 'manyFromOne',
    prevStep: null
  },
  'members': {
    mapping: 'manyFromOne',
    expandPattern: '
    prevStep: 'teams'
  }
}

interface FileContent {
  source: string,
  date: number,
  data: {}
}

/*   ___  _ __   ___ ___   _ __ ___   ___  _ __ ___
 *  / _ \| '_ \ / __/ _ \ | '_ ` _ \ / _ \| '__/ _ \
 * | (_) | | | | (_|  __/ | | | | | | (_) | | |  __/
 *  \___/|_| |_|\___\___| |_| |_| |_|\___/|_|  \___|
 *
 *  There's 2 dependency trees: names & contents
 *  Names tell you what files exist: branching
 *
 *  Names:
 *  [list1] -> [list2] -> [list3]
 *    {parent: string}
 *
 * Names overridden by directory listing
 * Files overridden by existent files
 *
 * function getFileResult(targetName, recipe) {
 *   return file(targetName) || recipe.transform(targetName, getSourceNames())
 * }
 * recipe.transform = function (targetName, sourceNames) {
 *   sourceNames.map(name => getFileResult(name, thi))
 * }
 *
 */


/*                    _         _
 *    ___  __ _  __ _(_)_ __   | |_ _ __ _   _
 *   |__ `/ _` |/ _` | | '_ \  | __| '__| | | |
 *  / __ | (_| | (_| | | | | | | |_| |  | |_| |
 *  \__,_|\__, |\__,_|_|_| |_|  \__|_|   \__, |
 *        |___/                          |___/
 *
 * The benefit of passing along a list of files is that
 * it's exclusive. You don't need to do a whole search
 * on every step. Feedback loops are still possible,
 * since searches are still req'd for branches
 *
 * Each search (req'd for branches) adds a 'listener'
 * to the single Chokidar event stream and
 * filters based on its own search pattern and
 * triggers changes to the file-list realtime DB
 *
 * List of all files (imaginary or real) as Feathers DB model
 *
 * Online-realtime-editable files exist in database
 * foremost, get serialized to FS later
 *
 *            > Chokidar will give us redundant events
 *            > after we write to FS, but let's not
 *            > worry about that
 *  ____      ^         __________            ________
 * |    | - chokidar > |          | -------> |        |
 * | FS |              | Feathers | realtime | Client |
 * |____| < buf write- |__________| <------- |________|
 *
 */

const listings$s = [xs.never()]
for (const recipe of recipes) {
  const latest = listings$s[listings$s.length - 1]
  listings$s.push(nextNames(latest, recipe))
}

function nextNames(fileListings$, recipe) {
  if (recipe.mapping === 'oneFromMany') {
    return fileListings$.map(listings => xs.combine(listings))
  }
}


