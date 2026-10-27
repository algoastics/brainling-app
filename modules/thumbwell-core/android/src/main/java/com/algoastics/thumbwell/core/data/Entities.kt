package com.algoastics.thumbwell.core.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One counted reel (`reel_event`). Holds no content: the app key and package, the surface signal
 * (a rule view id, never screen text), the dwell time, a salted fingerprint hash and the day.
 */
@Entity(
  tableName = "reel_event",
  indices = [Index("day_key"), Index("counted_at_ms")],
)
data class ReelEventEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  @ColumnInfo(name = "app_key") val appKey: String,
  @ColumnInfo(name = "package_name") val packageName: String,
  @ColumnInfo(name = "surface") val surface: String,
  /** Time the reel stayed on screen (monotonic clock); first the settle time, then the final dwell. */
  @ColumnInfo(name = "dwell_ms") val dwellMs: Long,
  /** Salted, non-reversible hash of the reel identity (position/page identity, never text). */
  @ColumnInfo(name = "fingerprint") val fingerprint: String,
  @ColumnInfo(name = "counted_at_ms") val countedAtMs: Long,
  @ColumnInfo(name = "day_key") val dayKey: String,
  @ColumnInfo(name = "time_zone") val timeZone: String,
  @ColumnInfo(name = "utc_offset_min") val utcOffsetMin: Int,
)

/** Sponsored reels seen (and excluded from the count) per Thumbwell day and app. Stored only. */
@Entity(tableName = "ad_daily", primaryKeys = ["day_key", "app_key"])
data class AdDailyEntity(
  @ColumnInfo(name = "day_key") val dayKey: String,
  @ColumnInfo(name = "app_key") val appKey: String,
  @ColumnInfo(name = "ads_seen") val adsSeen: Int,
  @ColumnInfo(name = "updated_at_ms") val updatedAtMs: Long,
)

/**
 * The per-player "already seen" state of one package, as an opaque JSON snapshot of identity
 * hashes and positions (no text). Survives process death; dropped when the Thumbwell day changes.
 */
@Entity(tableName = "seen_state")
data class SeenStateEntity(
  @PrimaryKey @ColumnInfo(name = "package_name") val packageName: String,
  @ColumnInfo(name = "day_key") val dayKey: String,
  @ColumnInfo(name = "payload") val payload: String,
  @ColumnInfo(name = "updated_at_ms") val updatedAtMs: Long,
)

/** Running total per Thumbwell day and app, kept in step with [ReelEventEntity] rows. */
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
