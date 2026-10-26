# Statistics documentation

- Created: 15 October 2026
- Last updated: 18 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 489](https://github.com/heidrun-org/heidrun/issues/489), [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 618](https://github.com/heidrun-org/heidrun/issues/618)

This folder holds all the information about the data layers of Heidrun Code, and about the statistics that read them. A data layer is one package that reads the facts of one source of information into one SQLite file.

Start with the first file. It says what we mean by a data layer, and it describes the four data layers. Then read the file of the statistic that you want to understand.

- [the_four_data_layers.md](the_four_data_layers.md): what a data layer is, the four data layers, the SQLite file that they share, and the rules that they share.
- [data_layer_operation_log.md](data_layer_operation_log.md): the log of the operations that the data layer receives, how to read it and replay it, what it costs, and a measurement on the Teamwright history.
- [data_layer_access_timing.md](data_layer_access_timing.md): the time that it takes to get the data of the Past chats sidebar section and of the Statistics window, for the collection and for the display, apart.
- [token_usage_and_cost.md](token_usage_and_cost.md): the tokens that the coding agents used, how Heidrun Code stores them, and how it turns them into an estimated cost.
- [user_activity_statistics.md](user_activity_statistics.md): the statistic of the time that the developer is in front of Heidrun Code, and the data layer that it reads.
- [work_of_one_person_statistics.md](work_of_one_person_statistics.md): the statistic of the commits, the pull requests, the issues, and the AI cost, and the data layers that it reads.
