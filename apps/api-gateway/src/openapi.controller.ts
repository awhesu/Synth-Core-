import { Controller, Get, Header, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '@syntherium/security';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class OpenApiController {
  private openApiSpec: string | null = null;

  @Public()
  @Get('openapi')
  @Header('Content-Type', 'text/yaml')
  getOpenApiSpec(): string {
    if (this.openApiSpec) {
      return this.openApiSpec;
    }

    // Try to load the bundled OpenAPI spec
    const possiblePaths = [
      // Development: relative to repo root
      path.join(process.cwd(), 'openapi/v0.1/dist/openapi.bundle.yaml'),
      // Production: in the dist folder
      path.join(__dirname, '../../../openapi/v0.1/dist/openapi.bundle.yaml'),
      // Fallback: monorepo root
      path.join(process.cwd(), '../../openapi/v0.1/dist/openapi.bundle.yaml'),
    ];

    for (const specPath of possiblePaths) {
      try {
        if (fs.existsSync(specPath)) {
          this.openApiSpec = fs.readFileSync(specPath, 'utf8');
          return this.openApiSpec;
        }
      } catch {
        // Continue to next path
      }
    }

    throw new HttpException(
      {
        code: 'OPENAPI_NOT_FOUND',
        message: 'OpenAPI specification not found. Run `pnpm api:bundle` first.',
        searchedPaths: possiblePaths,
      },
      HttpStatus.NOT_FOUND
    );
  }

  @Public()
  @Get('openapi.json')
  @Header('Content-Type', 'application/json')
  async getOpenApiSpecJson(): Promise<object> {
    // Load YAML and convert to JSON
    const yaml = this.getOpenApiSpec();
    
    // Simple YAML to JSON conversion for basic specs
    // In production, use a proper YAML parser
    try {
      // Dynamic import for yaml parsing
      const yamlModule = await import('yaml');
      return yamlModule.parse(yaml);
    } catch {
      throw new HttpException(
        {
          code: 'YAML_PARSE_ERROR',
          message: 'Failed to parse OpenAPI YAML. Install yaml package or use /openapi endpoint.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
