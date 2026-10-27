package com.algoastics.thumbwell.core.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** One counted reel. Holds no content: only the app key, the time and the Thumbwell day. */
@Entity(tableName = "count_events", indices = [Index("day_key")])
data class CountEventEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  @ColumnInfo(name = "app_key") val appKey: String,
  @ColumnInfo(name = "counted_at_ms") val countedAtMs: Long,
  @ColumnInfo(name = "day_key") val dayKey: String,
  @ColumnInfo(name = "time_zone") val timeZone: String,
  @ColumnInfo(name = "utc_offset_min") val utcOffsetMin: Int,
)

/** Running total per Thumbwell day and app, kept in step with [CountEventEntity] rows. */
@Entity(tableName = "daily_aggregates", primaryKeys = ["day_key", "app_key"])
data class DailyAggregateEntity(
  @ColumnInfo(name = "day_key") val dayKey: String,
  @ColumnInfo(name = "app_key") val appKey: String,
  @ColumnInfo(name = "count") val count: Int,
  @ColumnInfo(name = "updated_at_ms") val updatedAtMs: Long,
)

/** A change of the accessibility service health state (watchdog history for M9 notifications). */
@Entity(tableName = "health_events", indices = [Index("at_ms")])
data class HealthEventEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  @ColumnInfo(name = "at_ms") val atMs: Long,
  @ColumnInfo(name = "state") val state: String,
  @ColumnInfo(name = "reason") val reason: String,
)
