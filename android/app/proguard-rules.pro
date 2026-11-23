# kotlinx.serialization: keep generated serializers for our @Serializable DTOs.
-keepclassmembers @kotlinx.serialization.Serializable class app.munda.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class app.munda.**$$serializer { *; }
