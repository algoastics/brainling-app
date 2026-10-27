package com.algoastics.thumbwell.core.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration

/**
 * On-device store in app-private storage (backups are off app-wide). Schemas are exported to
 * `modules/thumbwell-core/android/schemas`; see docs/modules/M01-detection.md for the migration
 * procedure.
 */
@Database(
  entities = [CountEventEntity::class, DailyAggregateEntity::class, HealthEventEntity::class],
  version = 1,
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
  val ALL: Array<Migration> = emptyArray()
}
