package com.algoastics.thumbwell.core.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * On-device store in app-private storage (backups are off app-wide). Schemas are exported to
 * `modules/thumbwell-core/android/schemas`; see docs/modules/M01-detection.md for the migration
 * procedure.
 */
@Database(
  entities = [
    ReelEventEntity::class,
    DailyAggregateEntity::class,
    HealthEventEntity::class,
    AdDailyEntity::class,
    SeenStateEntity::class,
  ],
  version = 2,
  exportSchema = true,
)
abstract class ThumbwellDatabase : RoomDatabase() {
  abstract fun countDao(): CountDao

  abstract fun healthDao(): HealthDao

  companion object {
    const val NAME = "thumbwell.db"

    @Volatile private var instance: ThumbwellDatabase? = null

    fun get(context: Context): ThumbwellDatabase =
      instance ?: synchronized(this) {
        instance ?: Room.databaseBuilder(
          context.applicationContext,
          ThumbwellDatabase::class.java,
          NAME,
        )
          .addMigrations(*Migrations.ALL)
          .build()
          .also { instance = it }
      }
  }
}

/**
 * Every schema bump adds a `Migration(n, n + 1)` here plus a migration test against the exported
 * schema. There is deliberately no destructive fallback: losing counts is never acceptable.
 */
object Migrations {
  /**
   * 1 -> 2: `count_events` becomes `reel_event` with surface, package, dwell and fingerprint
   * columns (old rows get empty values); adds `ad_daily` and `seen_state`.
   */
  val V1_TO_V2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
      db.execSQL("DROP INDEX IF EXISTS index_count_events_day_key")
      db.execSQL("ALTER TABLE count_events RENAME TO reel_event")
      db.execSQL("ALTER TABLE reel_event ADD COLUMN package_name TEXT NOT NULL DEFAULT ''")
      db.execSQL("ALTER TABLE reel_event ADD COLUMN surface TEXT NOT NULL DEFAULT ''")
      db.execSQL("ALTER TABLE reel_event ADD COLUMN dwell_ms INTEGER NOT NULL DEFAULT 0")
      db.execSQL("ALTER TABLE reel_event ADD COLUMN fingerprint TEXT NOT NULL DEFAULT ''")
      db.execSQL("CREATE INDEX IF NOT EXISTS index_reel_event_day_key ON reel_event (day_key)")
      db.execSQL(
        "CREATE INDEX IF NOT EXISTS index_reel_event_counted_at_ms ON reel_event (counted_at_ms)",
      )
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS ad_daily (day_key TEXT NOT NULL, app_key TEXT NOT NULL, " +
          "ads_seen INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL, PRIMARY KEY(day_key, app_key))",
      )
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS seen_state (package_name TEXT NOT NULL, day_key TEXT NOT NULL, " +
          "payload TEXT NOT NULL, updated_at_ms INTEGER NOT NULL, PRIMARY KEY(package_name))",
      )
    }
  }

  val ALL: Array<Migration> = arrayOf(V1_TO_V2)
}
