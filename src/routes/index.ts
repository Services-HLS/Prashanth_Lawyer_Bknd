import { Router } from "express";

import { tableConfigs } from "../config/tables.js";
import { articlesRouter } from "./articles.js";
import { booksRouter } from "./books.js";
import { createCrudRouter } from "./crudRouter.js";
import { aiRouter } from "./ai.js";
import { formsRouter } from "./forms.js";
import { authRouter } from "./auth.js";
import { healthRouter } from "./health.js";
import { imagesRouter } from "./images.js";
import { siteRouter } from "./site.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/images", imagesRouter);
apiRouter.use("/site", siteRouter);
apiRouter.use("/forms", formsRouter);
apiRouter.use("/ai", aiRouter);

const articles = Router();
articles.use(articlesRouter);
articles.use(createCrudRouter({ config: tableConfigs.articles, publicList: false }));
apiRouter.use("/articles", articles);

apiRouter.use("/topics", createCrudRouter({ config: tableConfigs.topics }));
const books = Router();
books.use(booksRouter);
books.use(createCrudRouter({ config: tableConfigs.books }));
apiRouter.use("/books", books);
apiRouter.use("/podcasts", createCrudRouter({ config: tableConfigs.podcasts }));
apiRouter.use("/about", createCrudRouter({ config: tableConfigs.about }));
apiRouter.use(
  "/practice-areas",
  createCrudRouter({ config: tableConfigs.practiceAreas, slugRoute: true }),
);
apiRouter.use(
  "/timeline",
  createCrudRouter({ config: tableConfigs.timelineEntries, slugRoute: false }),
);
apiRouter.use(
  "/memberships",
  createCrudRouter({ config: tableConfigs.memberships, slugRoute: false }),
);
apiRouter.use(
  "/speaking-events",
  createCrudRouter({ config: tableConfigs.speakingEvents, slugRoute: false }),
);
apiRouter.use(
  "/collaboration-services",
  createCrudRouter({ config: tableConfigs.collaborationServices, slugRoute: false }),
);
apiRouter.use("/resources", createCrudRouter({ config: tableConfigs.resources }));
apiRouter.use(
  "/testimonials",
  createCrudRouter({ config: tableConfigs.testimonials, slugRoute: false }),
);
apiRouter.use(
  "/ticker",
  createCrudRouter({ config: tableConfigs.tickerItems, slugRoute: false }),
);
apiRouter.use(
  "/publications",
  createCrudRouter({ config: tableConfigs.publicationLogos, slugRoute: false }),
);
apiRouter.use(
  "/contact-details",
  createCrudRouter({ config: tableConfigs.contactDetails, slugRoute: false }),
);
apiRouter.use(
  "/social-links",
  createCrudRouter({ config: tableConfigs.socialLinks, slugRoute: false }),
);
