## Current

- [x] Load the original transcript instantly as soon as we get it and use loading spinners around the LLM-generated sections till we get it
- [x] Have the option to rerun any particular file through the LLM prompt again. You should create a new file and not replace the previously created file.
- [x] If a transcript is not available for a particular video, do not make the LLM call. Display an appropriate message.
- [x] Don't have the word "Transcript" as the title of the LLM summarization, something else, make the subheadings a little larger
- [x] have a 'compress' (call it this or something more interesting) % setting here (this should reflect in the LLM prompt), ie, 100%, shouldn't summarize at all, it should just split up the sections with headings etc. Set default to 50%. If compression ratio is not selected (optional), revert to the original prompt (1-2 lines per section).
- [x] add openrouter API key + model selector
- [x] Have an 'x minute read' right under the heading in a subtle font and size, depending on the word count
- [x] Display which model generated the summary (next to reading time)
- [x] Disable the Rerun LLM button while the LLM is generating content (added disabled styling)
- [x] Fix loading overlay cleanup in finally block
- [x] the loading spinner should not be scrollable (currently if i press the re-run LLM button, i can scroll down to see the previous generated text. it looks buggy.)
- [x] Clean up the JavaScript file, make it modular, break it up into separate files.
- [x] Allow for bulk deletion from the side panel. (It should have a select all toggle.)
- [x] Bulk selection is good, but prevent layout shift when the delete icon appears
- [x] Make the side panel a little wider so more of the titles can be read.

## Later

- [ ] mobile responsiveness
- [x] add support for other models as well (flagship)
- [ ] keep meta data about 'saved' summaries. So the LLM can make interesting connections between the subjects
- [ ] I should be able to 'cross-pollinate ideas/combine/find differences' between one or more selected files, create another section for this.
- [x] stream the output?

- [ ] scan the codebase for architecture improvements

- [ ] It should look through the pool of already existing metadata, such as category concepts, entities, and tags, and see if it most closely fits something or the structure of how it's written. The last 1% may be written as 'last -1%', or 'last -1%', these sorts of things. Make sure it's consistent so making connections is easy. We want to keep the metadata as consistent and not just keep generating new tags over and over again. Otherwise, we defeat the purpose of being able to make connections.

Okay, the next step in the development process is to have a place in the platform where, on the basis of metadata (that being category, concepts, entities, and tags), we make connections between documents. The documents being the summaries, key insights, and action items. How do we go about doing that, and where do you suggest the best part in the platform to do this?

---

## Bugs

- Perhaps we should have a central file which collects all the metadata and has references to all the files that use this metadata.

help me expand on this idea, where can i have this button?

- [x] Convert this project to react
- [x] tooltips for complex concepts? (this makes a further LLM call): highlighting portion of text should show a mini floating toolbar with an Ask LLM button. This should fetch this information on the selection in the context of the category tag. Where might this additional information be populated? It should also be persisted in this page. Give me some suggestions.
- [ ] auto sort content by category tags?
- [ ] key people etc should be a part of it? What other valuable metadata can we extract from it?
- [ ] allow file renaming (in the history section)

- [ ] Are we using the JS files any longer that were used for the pure vanilla JS implementation? If not, we should remove them. Do a codebase cleanup.

- [ ] Can we check for more errors such as this that might have happened during the conversion from Vanilla JS to React? Do an audit.
      " I see the issue now. The old markdown content was set via innerHTML directly on the DOM, and when we switch to rendering JSX (loading skeleton), React doesn't  
       clear that innerHTML. I need to explicitly clear it."

- [ ] Let's redesign this UI.
- Let's have an analyze button on the top.
- Let's have a sticky header that stretches all across the top.
  When I press analyze, it takes me to a different page and it has the index of all the summaries so far. I should be able to then select it and run my query from there.
  Okay, let's see if we have any questions.

- In the Metadata Explorer page, what should happen is the moment I select an option or a tag: it should automatically filter what's left on the basis of that selection.

- [ ] Increase the target area of the checkboxes. I need to be very precise currently.
- [ ] When files get deleted, the indexing & associations based on the connections should be updated. Also, when new files are created, the related tab on the right-hand pane should have an "Update Index" button. In fact, there should always be an "Update Index" button, just in case it's out of date.

- [ ] Generated idea should have a different tile color. Also, I should be able to switch between summaries and generated connections. What should we call this?
- [ ] I should not be able to click out while I am analyzing a particular file. It should give me a discard modal warning.
- [ ] How can we create a graph, sort of a network graph for connected ideas, similar to what we have in the related view?

- [ ] Links in the metadata section should be hyperlinked and should open in a new tab.
- [ ] Split up Ask LLM floating bar into two buttons:

1. One is custom question (this opens up a modal where a user can ask their own question, have a preset text 'elaborate on this')
2. The other is elaborate based on the context, (which is what it does right now)
   In both cases, it should populate in the same place where it is populating right now, which is the notes section in the right side bar.

- [ ] What libraries can be used to simplify some of our work here, like querying things like regex, etc.? I feel these can be quite fragile. What about other things that we can simplify by implementing libraries that are lightweight?

- There should be a clear filters button options Meta Data Explorer page. Perhaps the top right of each category section saying "reset"

- After generating a summary, when I'm about to save it, tt should automatically pick up the file name from the generated title (the top most title)
- I should be able to cross out the chips in the multi-summary analysis from the selected summaries.
- In the summaries pane, the top up to the search menu should be sticky. I should have a similar experience in the analysis menu in the right side of the analysis page, where I should be able to search through the analysis.
