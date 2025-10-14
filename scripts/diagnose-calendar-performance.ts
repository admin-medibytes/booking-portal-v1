// /**
//  * Diagnostic script to measure calendar query performance
//  */

// import "dotenv/config";
// import { db } from "@/server/db";
// import { bookings, examinees, specialists } from "@/server/db/schema";
// import { users } from "@/server/db/schema/auth";
// import { and, gte, lte, desc, inArray, eq } from "drizzle-orm";

// async function diagnosePerformance() {
//   console.log("🔍 Diagnosing calendar query performance...\n");

//   // Test date range (current month)
//   const now = new Date();
//   const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
//   const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

//   console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

//   // Test 1: Count bookings in date range
//   console.log("Test 1: Counting bookings in range...");
//   const start1 = Date.now();
//   const count = await db
//     .select()
//     .from(bookings)
//     .where(and(gte(bookings.dateTime, startDate), lte(bookings.dateTime, endDate)));
//   const time1 = Date.now() - start1;
//   console.log(`  ✓ Found ${count.length} bookings in ${time1}ms\n`);

//   // Test 2: Fetch with OLD method (Drizzle relational query)
//   console.log("Test 2: Fetching with OLD Drizzle relational query...");
//   const start2 = Date.now();
//   const bookingsOld = await db.query.bookings.findMany({
//     where: and(gte(bookings.dateTime, startDate), lte(bookings.dateTime, endDate)),
//     limit: 500,
//     with: {
//       specialist: {
//         columns: { id: true, name: true },
//         with: {
//           user: {
//             columns: { id: true, jobTitle: true },
//           },
//         },
//       },
//       examinee: {
//         columns: {
//           id: true,
//           firstName: true,
//           lastName: true,
//           email: true,
//         },
//       },
//     },
//   });
//   const time2 = Date.now() - start2;
//   console.log(`  ✓ Fetched ${bookingsOld.length} bookings in ${time2}ms\n`);

//   // Test 2b: Fetch with NEW method (raw SQL joins)
//   console.log("Test 2b: Fetching with NEW raw SQL joins...");
//   const start2b = Date.now();
//   const bookingsNew = await db
//     .select({
//       id: bookings.id,
//       organizationId: bookings.organizationId,
//       teamId: bookings.teamId,
//       createdById: bookings.createdById,
//       referrerId: bookings.referrerId,
//       specialistId: bookings.specialistId,
//       examineeId: bookings.examineeId,
//       status: bookings.status,
//       type: bookings.type,
//       duration: bookings.duration,
//       location: bookings.location,
//       dateTime: bookings.dateTime,
//       acuityAppointmentId: bookings.acuityAppointmentId,
//       acuityAppointmentTypeId: bookings.acuityAppointmentTypeId,
//       acuityCalendarId: bookings.acuityCalendarId,
//       scheduledAt: bookings.scheduledAt,
//       completedAt: bookings.completedAt,
//       cancelledAt: bookings.cancelledAt,
//       createdAt: bookings.createdAt,
//       updatedAt: bookings.updatedAt,
//       specialist: {
//         id: specialists.id,
//         name: specialists.name,
//         user: {
//           id: users.id,
//           jobTitle: users.jobTitle,
//         },
//       },
//       examinee: {
//         id: examinees.id,
//         firstName: examinees.firstName,
//         lastName: examinees.lastName,
//         email: examinees.email,
//       },
//     })
//     .from(bookings)
//     .leftJoin(specialists, eq(bookings.specialistId, specialists.id))
//     .leftJoin(users, eq(specialists.userId, users.id))
//     .leftJoin(examinees, eq(bookings.examineeId, examinees.id))
//     .where(and(gte(bookings.dateTime, startDate), lte(bookings.dateTime, endDate)))
//     .orderBy(desc(bookings.dateTime))
//     .limit(500);
//   const time2b = Date.now() - start2b;
//   console.log(`  ✓ Fetched ${bookingsNew.length} bookings in ${time2b}ms\n`);

//   const improvement2 = Math.round(((time2 - time2b) / time2) * 100);
//   console.log(`  📈 Improvement: ${improvement2}% faster (saved ${time2 - time2b}ms)\n`);

//   // Test 3: Check if index exists on date_time
//   console.log("Test 3: Checking for date_time index...");
//   const start3 = Date.now();
//   const indexes = await db.execute(`
//     SELECT indexname
//     FROM pg_indexes
//     WHERE tablename = 'bookings'
//     AND indexname LIKE '%date_time%'
//   `);
//   const time3 = Date.now() - start3;

//   if (indexes.length > 0) {
//     console.log(`  ✓ Found ${indexes.length} index(es) on date_time`);
//   } else {
//     console.log("  ⚠️  WARNING: No index found on date_time column!");
//     console.log("  💡 This could cause slow queries. Consider adding an index.");
//   }
//   console.log(`  Query time: ${time3}ms\n`);

//   // Test 4: Full calendar query (as performed by the app)
//   console.log("Test 4: Full calendar query simulation...");
//   const start4 = Date.now();
//   const fullQuery = await db.query.bookings.findMany({
//     where: and(
//       gte(bookings.dateTime, startDate),
//       lte(bookings.dateTime, endDate),
//       eq(bookings.status, "active")
//     ),
//     orderBy: desc(bookings.createdAt),
//     limit: 500,
//     with: {
//       specialist: {
//         columns: { id: true, name: true },
//         with: {
//           user: {
//             columns: { id: true, jobTitle: true },
//           },
//         },
//       },
//       referrer: {
//         columns: {
//           id: true,
//           firstName: true,
//           lastName: true,
//           email: true,
//         },
//         with: {
//           organization: {
//             columns: { id: true, name: true },
//           },
//         },
//       },
//       examinee: {
//         columns: {
//           id: true,
//           firstName: true,
//           lastName: true,
//           email: true,
//           phoneNumber: true,
//           condition: true,
//           caseType: true,
//         },
//       },
//     },
//   });
//   const time4 = Date.now() - start4;
//   console.log(`  ✓ Full query completed in ${time4}ms`);
//   console.log(`  📊 Fetched ${fullQuery.length} bookings with full relations\n`);

//   // Summary
//   console.log("=" .repeat(60));
//   console.log("📊 Performance Summary:");
//   console.log(`  - Simple count: ${time1}ms`);
//   console.log(`  - OLD relational query: ${time2}ms`);
//   console.log(`  - NEW raw SQL joins: ${time2b}ms (${improvement2}% faster)`);
//   console.log(`  - Index check: ${time3}ms`);
//   console.log(`  - Full query: ${time4}ms`);
//   console.log("=" .repeat(60));

//   if (time2b > 5000) {
//     console.log("\n⚠️  WARNING: New query is still taking more than 5 seconds!");
//     console.log("Recommended optimizations:");
//     console.log("  1. Check database connection latency");
//     console.log("  2. Consider database server resources");
//     console.log("  3. Review query execution plan with EXPLAIN");
//   } else if (time2b > 3000) {
//     console.log("\n⚠️  New query is slower than ideal (>3s)");
//     console.log("Consider checking database connection and server resources");
//   } else {
//     console.log("\n✅ New raw SQL join optimization is working well!");
//     console.log(`   Calendar queries should now be ~${improvement2}% faster`);
//   }

//   process.exit(0);
// }

// diagnosePerformance().catch((error) => {
//   console.error("❌ Error:", error);
//   process.exit(1);
// });
