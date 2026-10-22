package com.algoastics.brainling.core.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction

@Dao
abstract class CountDao {
  @Insert
  protected abstract fun insertEvent(event: CountEventEntity): Long

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

  /** Stores one counted reel and bumps its daily aggregate atomically. */
  @Transaction
  open fun record(event: CountEventEntity) {
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
