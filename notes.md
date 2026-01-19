## Current

- [x] Load the original transcript instantly as soon as we get it and use loading spinners around the LLM-generated sections till we get it
- [x] Have the option to rerun any particular file through the LLM prompt again. You should create a new file and not replace the previously created file.
- [x] If a transcript is not available for a particular video, do not make the LLM call. Display an appropriate message.
- [x] Don't have the word "Transcript" as the title of the LLM summarization, something else, make the subheadings a little larger
- [x] have a 'compress' (call it this or something more interesting) % setting here (this should reflect in the LLM prompt), ie, 100%, shouldn't summarize at all, it should just split up the sections with headings etc. Set default to 50%. If compression ratio is not selected (optional), revert to the original prompt (1-2 lines per section).
- [ ] The main section, after the LLM responds, the Heading "transcript" suggests that it's the original transcript. Instead have summarization or something more interesting as the heading to the LLM summarization
- [ ] While the LLM is processing the data, run the loading spinner in the center section, leaving the transcript on the right-hand side viewable. Currently the loading spinner occupies the right-hand side and covers the transcript as well

## Later

- [ ] add support for other models as well (flagship)
- [ ] keep meta data about 'saved' summaries. So the LLM can make interesting connections between the subjects
- [ ] I should be able to 'cross-pollinate ideas/combine/find differences' between one or more selected files, create another section for this.
