fn main() {
    println!("cargo:rerun-if-changed=sql");
    // Windows embeds the ICO in the executable; the tray also loads that resource.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
