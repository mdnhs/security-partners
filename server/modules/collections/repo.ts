import "server-only"

import { asc } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  clients,
  groupCompanies,
  teamMembers,
} from "@/server/db/schema"

export function listCategoryRows(db: DbOrTx) {
  return db
    .select()
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}

export function listTeamRows(db: DbOrTx) {
  return db
    .select()
    .from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name))
}

export function listClientRows(db: DbOrTx) {
  return db
    .select()
    .from(clients)
    .orderBy(asc(clients.sortOrder), asc(clients.name))
}

export function listGroupCompanyRows(db: DbOrTx) {
  return db
    .select()
    .from(groupCompanies)
    .orderBy(asc(groupCompanies.sortOrder), asc(groupCompanies.name))
}
