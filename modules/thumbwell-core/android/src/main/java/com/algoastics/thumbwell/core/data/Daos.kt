package com.algoastics.thumbwell.core.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
abstract class CountDao {
  @Insert
  protected abstract fun insertEvent(event: ReelEventEntity): Long

  // INSERT OR IGNORE + UPDATE instead of an UPSERT: SQLite on API 24-29 predates ON CONFLICT DO.
  @Query(
    "INSERT OR IGNORE INTO daily_aggregates(day_key, app_key, count, updated_at_ms) " +
      "VALUES(:dayKey, :appKey, 0, :nowMs)",
  )
  protected abstract fun ensureAggregate(dayKey: String, appKey: String, nowMs: Long)

  @Query(
    "UPDATE daily_aggregates SET count = count + :delta, updated_at_ms = :nowMs " +
      "WHERE day_key = :dayKey AND app_key = :appKey",
  )
  protected abstract fun addToAggregate(dayKey: String, appKey: String, delta: Int, nowMs: Long)

  @Query("SELECT * FROM daily_aggregates WHERE day_key = :dayKey")
  abstract fun aggregatesFor(dayKey: String): List<DailyAggregateEntity>

  /** The newest [limit] day keys that have counts or ads, newest first. */
  @Query(
    "SELECT day_key FROM (SELECT day_key FROM daily_aggregates UNION SELECT day_key FROM ad_daily) " +
      "ORDER BY day_key DESC LIMIT :limit",
  )
  abstract fun recentDays(limit: Int): List<String>

  @Query("SELECT * FROM ad_daily WHERE day_key = :dayKey")
  abstract fun adsFor(dayKey: String): List<AdDailyEntity>

  @Query(
    "INSERT OR IGNORE INTO ad_daily(day_key, app_key, ads_seen, updated_at_ms) " +
      "VALUES(:dayKey, :appKey, 0, :nowMs)",
  )
  protected abstract fun ensureAd(dayKey: String, appKey: String, nowMs: Long)

  @Query(
    "UPDATE ad_daily SET ads_seen = ads_seen + 1, updated_at_ms = :nowMs " +
      "WHERE day_key = :dayKey AND app_key = :appKey",
  )
  protected abstract fun addAd(dayKey: String, appKey: String, nowMs: Long)

  /** Counts one sponsored reel seen for [appKey] on [dayKey]. */
  @Transaction
  open fun recordAd(dayKey: String, appKey: String, nowMs: Long) {
    ensureAd(dayKey, appKey, nowMs)
    addAd(dayKey, appKey, nowMs)
  }

  /** Final dwell of the reel counted at [countedAtMs] (matched by app and time). */
  @Query(
    "UPDATE reel_event SET dwell_ms = :dwellMs WHERE app_key = :appKey AND counted_at_ms = :countedAtMs",
  )
  abstract fun updateDwell(appKey: String, countedAtMs: Long, dwellMs: Long)

  /** Raw events older than the retention window; daily aggregates keep the roll-up. */
  @Query("DELETE FROM reel_event WHERE counted_at_ms < :beforeMs")
  abstract fun pruneEventsBefore(beforeMs: Long): Int

  @Query("SELECT * FROM reel_event WHERE day_key = :dayKey ORDER BY counted_at_ms")
  abstract fun eventsFor(dayKey: String): List<ReelEventEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  abstract fun putSeenState(state: SeenStateEntity)

  @Query("SELECT * FROM seen_state WHERE day_key = :dayKey")
  abstract fun seenStatesFor(dayKey: String): List<SeenStateEntity>

  /** Drops every snapshot not from [dayKey] (day start clears the seen state). */
  @Query("DELETE FROM seen_state WHERE day_key != :dayKey")
  abstract fun clearSeenStatesExcept(dayKey: String)

  @Query("DELETE FROM seen_state")
  abstract fun clearSeenStates()

  /** Stores one counted reel and bumps its daily aggregate atomically. */
  @Transaction
  open fun record(event: ReelEventEntity) {
    insertEvent(event)
    ensureAggregate(event.dayKey, event.appKey, event.countedAtMs)
    addToAggregate(event.dayKey, event.appKey, 1, event.countedAtMs)
  }

  /** Adds imported totals (no per-reel events exist for them). */
  @Transaction
  open fun importAggregates(rows: List<DailyAggregateEntity>) {
    for (row in rows) {
      ensureAggregate(row.dayKey, row.appKey, row.updatedAtMs)
      addToAggregate(row.dayKey, row.appKey, row.count, row.updatedAtMs)
    }
  }
}

@Dao
abstract class HealthDao {
  @Insert
  abstract fun insert(event: HealthEventEntity): Long

  @Query("SELECT * FROM health_events ORDER BY at_ms DESC, id DESC LIMIT :limit")
  abstract fun recent(limit: Int): List<HealthEventEntity>

  @Query("DELETE FROM health_events WHERE at_ms < :beforeMs")
  abstract fun deleteBefore(beforeMs: Long)
}
